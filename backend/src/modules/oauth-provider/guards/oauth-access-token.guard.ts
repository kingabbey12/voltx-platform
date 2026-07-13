import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { AuthContextService } from '../../auth/auth-context.service';
import { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { sha256Hex } from '../../security/utils/security-hash.util';
import { OAuthTokenRepository } from '../oauth-token.repository';

const BEARER_PREFIX = 'Bearer ';

/**
 * A drop-in alternative to AUTH_GUARDS for requests made by a third-party
 * OAuth application on behalf of an authorizing user. Unlike every other
 * Developer Platform credential (PAT, Service Account, API key), this
 * deliberately reads the standard `Authorization: Bearer <token>` header
 * rather than a dedicated `X-*` header — real OAuth2 client libraries only
 * ever send bearer tokens that way (RFC 6750), so interoperability
 * requires it. There is no collision with JwtAuthGuard's own use of the
 * same header: the two are never applied to the same route, exactly like
 * ApiKeyGuard/PersonalAccessTokenGuard/ServiceAccountGuard are each their
 * own explicit, opt-in alternative to AUTH_GUARDS rather than merged with
 * it.
 *
 * Effective permissions are the intersection of what's frozen on the
 * access token (the scopes granted at consent time) and whatever the
 * authorizing user's membership currently, live, grants — same
 * narrowing rule as PersonalAccessTokenGuard, so a role downgrade after
 * the fact immediately narrows what the app can do too.
 */
@Injectable()
export class OAuthAccessTokenGuard implements CanActivate {
  constructor(
    private readonly tokenRepository: OAuthTokenRepository,
    private readonly authContextService: AuthContextService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const header = request.headers.authorization;

    if (typeof header !== 'string' || !header.startsWith(BEARER_PREFIX)) {
      throw new UnauthorizedException('Missing Bearer access token');
    }

    const rawToken = header.slice(BEARER_PREFIX.length).trim();
    if (rawToken.length === 0) {
      throw new UnauthorizedException('Missing Bearer access token');
    }

    const token = await this.tokenRepository.findActiveAccessTokenByHash(sha256Hex(rawToken));
    if (!token) {
      throw new UnauthorizedException('Invalid, expired, or revoked access token');
    }

    const currentUser = await this.authContextService.resolveCurrentUser(
      token.authorizingUserId,
      token.authorizingOrganizationId,
    );
    if (!currentUser) {
      throw new UnauthorizedException('The authorizing user is no longer an active member');
    }

    request.currentUser = {
      ...currentUser,
      permissions: currentUser.permissions.filter((permission) =>
        token.scopes.includes(permission),
      ),
    };

    this.tenantContextService.set({
      organizationId: currentUser.organizationId,
      userId: currentUser.id,
      membershipId: currentUser.membershipId,
    });

    return true;
  }
}
