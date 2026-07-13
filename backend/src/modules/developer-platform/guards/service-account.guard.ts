import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ServiceAccountStatus } from '@prisma/client';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { AuthContextService } from '../../auth/auth-context.service';
import { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { sha256Hex } from '../../security/utils/security-hash.util';
import { ServiceAccountRepository } from '../service-account.repository';

const SERVICE_ACCOUNT_TOKEN_HEADER = 'x-service-account-token';

/**
 * A drop-in alternative to AUTH_GUARDS for machine-to-machine callers
 * acting as an organization's own service account. Unlike ApiKeyGuard
 * (which builds a synthetic permission set straight from the key row),
 * this resolves permissions via the exact same
 * AuthContextService.resolveCurrentUser() a human JWT login uses,
 * because a ServiceAccount has a real Membership — role changes and
 * permission grants apply to it identically and immediately, with zero
 * bespoke authorization logic.
 */
@Injectable()
export class ServiceAccountGuard implements CanActivate {
  constructor(
    private readonly serviceAccountRepository: ServiceAccountRepository,
    private readonly authContextService: AuthContextService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const rawToken = request.headers[SERVICE_ACCOUNT_TOKEN_HEADER];

    if (typeof rawToken !== 'string' || rawToken.length === 0) {
      throw new UnauthorizedException('Missing X-Service-Account-Token header');
    }

    const token = await this.serviceAccountRepository.findActiveTokenByHash(sha256Hex(rawToken));
    if (!token) {
      throw new UnauthorizedException('Invalid, expired, or revoked service account token');
    }

    const serviceAccount = await this.serviceAccountRepository.findByIdUnscoped(
      token.serviceAccountId,
    );
    if (!serviceAccount || serviceAccount.status !== ServiceAccountStatus.ACTIVE) {
      throw new UnauthorizedException('Service account is not active');
    }

    const currentUser = await this.authContextService.resolveCurrentUser(
      serviceAccount.userId,
      serviceAccount.organizationId,
    );
    if (!currentUser) {
      throw new UnauthorizedException('Service account membership is not active');
    }

    void this.serviceAccountRepository.touchTokenLastUsedAt(token.id);

    request.currentUser = currentUser;

    this.tenantContextService.set({
      organizationId: currentUser.organizationId,
      userId: currentUser.id,
      membershipId: currentUser.membershipId,
    });

    return true;
  }
}
