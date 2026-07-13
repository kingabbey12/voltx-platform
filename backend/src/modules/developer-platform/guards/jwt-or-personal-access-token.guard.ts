import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { UserContextGuard } from '../../auth/guards/user-context.guard';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { PersonalAccessTokenGuard } from './personal-access-token.guard';

const PAT_HEADER = 'x-personal-access-token';

/**
 * The v2.3 Developer Platform's whole point is letting a developer's own
 * script/CLI call the real business API, not just a diagnostic whoami
 * route — but PersonalAccessTokenGuard (like ApiKeyGuard/ServiceAccountGuard)
 * was originally only ever wired to its own whoami controller. This guard
 * closes that gap for the specific surface that needs it today (the Voltx
 * CLI's workflow commands, see packages/cli): if an
 * `X-Personal-Access-Token` header is present, authentication is delegated
 * entirely to PersonalAccessTokenGuard (which sets tenant context itself);
 * otherwise this falls through to the exact same JWT + membership + tenant
 * chain AUTH_GUARDS already runs. A route protected by this guard behaves
 * identically to AUTH_GUARDS for every existing JWT-bearing request — the
 * PAT path is strictly additive.
 *
 * TenantGuard is deliberately NOT part of the JWT fallback chain here: its
 * own check (`request.tenantJwtPrincipal` cross-referenced against
 * `request.currentUser`) is JWT-specific, so it's reimplemented inline for
 * the JWT path only, matching TenantGuard's own logic exactly.
 */
@Injectable()
export class JwtOrPersonalAccessTokenGuard implements CanActivate {
  constructor(
    private readonly personalAccessTokenGuard: PersonalAccessTokenGuard,
    private readonly jwtAuthGuard: JwtAuthGuard,
    private readonly userContextGuard: UserContextGuard,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (typeof request.headers[PAT_HEADER] === 'string') {
      return this.personalAccessTokenGuard.canActivate(context);
    }

    const jwtResult = this.jwtAuthGuard.canActivate(context);
    const jwtOk = jwtResult instanceof Promise ? await jwtResult : jwtResult;
    if (!jwtOk) {
      return false;
    }

    const userContextResult = this.userContextGuard.canActivate(context);
    const userContextOk =
      userContextResult instanceof Promise ? await userContextResult : userContextResult;
    if (!userContextOk) {
      return false;
    }

    return this.assertTenant(request);
  }

  /** Mirrors TenantGuard.canActivate exactly — see its own file for the
   * original, JWT-only implementation this delegates the non-PAT path to
   * conceptually. */
  private assertTenant(request: AuthenticatedRequest): boolean {
    if (!request.currentUser) {
      throw new UnauthorizedException('Authenticated user context is missing');
    }
    if (!request.tenantJwtPrincipal) {
      throw new ForbiddenException('Tenant could not be resolved from JWT');
    }
    if (request.tenantJwtPrincipal.userId !== request.currentUser.id) {
      throw new ForbiddenException('Tenant user mismatch');
    }
    if (request.tenantJwtPrincipal.organizationId !== request.currentUser.organizationId) {
      throw new ForbiddenException('Cross-tenant access is forbidden');
    }

    const existingContext = this.tenantContextService.get();
    const requestId = existingContext?.requestId;
    if (!requestId) {
      throw new ForbiddenException('Request context is missing');
    }

    request.tenantContext = {
      organizationId: request.currentUser.organizationId,
      userId: request.currentUser.id,
      membershipId: request.currentUser.membershipId,
      requestId,
      supportSessionId: existingContext?.supportSessionId,
    };
    this.tenantContextService.set(request.tenantContext);

    return true;
  }
}
