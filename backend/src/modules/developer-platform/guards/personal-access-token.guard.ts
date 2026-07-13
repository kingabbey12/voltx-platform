import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { AuthContextService } from '../../auth/auth-context.service';
import { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { sha256Hex } from '../../security/utils/security-hash.util';
import { PersonalAccessTokenRepository } from '../personal-access-token.repository';

const PAT_HEADER = 'x-personal-access-token';
const ORGANIZATION_HEADER = 'x-organization-id';

/**
 * A drop-in alternative to AUTH_GUARDS for a developer's own scripts,
 * mirroring ApiKeyGuard's shape exactly — except a Personal Access Token
 * is user-scoped, not pre-bound to one organization, so the caller must
 * say which org it's acting in via X-Organization-Id. Effective
 * permissions are the intersection of what's frozen on the token
 * (scopedPermissions, set at creation) and whatever that organization's
 * membership currently, live, grants (resolved via the exact same
 * AuthContextService.resolveCurrentUser() a JWT login uses) — never
 * more than either alone would allow.
 */
@Injectable()
export class PersonalAccessTokenGuard implements CanActivate {
  constructor(
    private readonly personalAccessTokenRepository: PersonalAccessTokenRepository,
    private readonly authContextService: AuthContextService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const rawToken = request.headers[PAT_HEADER];

    if (typeof rawToken !== 'string' || rawToken.length === 0) {
      throw new UnauthorizedException('Missing X-Personal-Access-Token header');
    }

    const pat = await this.personalAccessTokenRepository.findActiveByHash(sha256Hex(rawToken));
    if (!pat) {
      throw new UnauthorizedException('Invalid, expired, or revoked personal access token');
    }

    const organizationId = request.headers[ORGANIZATION_HEADER];
    if (typeof organizationId !== 'string' || organizationId.length === 0) {
      throw new BadRequestException('Missing X-Organization-Id header');
    }

    const currentUser = await this.authContextService.resolveCurrentUser(
      pat.userId,
      organizationId,
    );
    if (!currentUser) {
      throw new ForbiddenException('You are not an active member of this organization');
    }

    void this.personalAccessTokenRepository.touchLastUsedAt(pat.id);

    request.currentUser = {
      ...currentUser,
      permissions: currentUser.permissions.filter((permission) =>
        pat.scopedPermissions.includes(permission),
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
