import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { REQUIRE_FEATURE_METADATA_KEY } from '../constants/require-feature-metadata.constants';
import { RequireFeatureOptions } from '../decorators/require-feature.decorator';
import { QuotaService } from '../quota.service';

/**
 * Composes into a controller's @UseGuards alongside AUTH_GUARDS/
 * PermissionGuard wherever @RequireFeature is used — throws a
 * structured 403 (Nest has no built-in 402; ForbiddenException is the
 * closest semantic fit and matches every other authorization failure in
 * this codebase) carrying `{code, featureKey, limit, currentUsage}` in
 * `details` so the client can render a specific upgrade prompt instead
 * of a generic "forbidden" message.
 */
@Injectable()
export class FeatureGateGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly quotaService: QuotaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<RequireFeatureOptions | undefined>(
      REQUIRE_FEATURE_METADATA_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.currentUser) {
      throw new UnauthorizedException('Authenticated user context is missing');
    }

    const result = await this.quotaService.checkQuota(
      request.currentUser.organizationId,
      required.featureKey,
      required.quantity,
    );

    if (!result.allowed) {
      throw new ForbiddenException({
        code: result.reason ?? 'QUOTA_EXCEEDED',
        message:
          result.reason === 'SUBSCRIPTION_INACTIVE'
            ? 'Your subscription is not active — update your billing to continue.'
            : `You have reached your plan's limit for "${result.featureKey}".`,
        details: {
          featureKey: result.featureKey,
          limit: result.limit,
          currentUsage: result.currentUsage,
        },
      });
    }

    return true;
  }
}
