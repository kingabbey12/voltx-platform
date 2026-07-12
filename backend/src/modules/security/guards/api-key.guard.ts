import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { AuthenticatedRequest } from '../../auth/interfaces/authenticated-request.interface';
import { ApiKeyRepository } from '../api-key.repository';
import { sha256Hex } from '../utils/security-hash.util';

const API_KEY_HEADER = 'x-api-key';

/**
 * A drop-in alternative to AUTH_GUARDS for machine-to-machine callers: it
 * resolves organization + permission context entirely from the API key
 * itself — mirroring what UserContextGuard/TenantGuard do for a JWT bearer
 * request, not layered on top of them. A route protected by
 * `[ApiKeyGuard, PermissionGuard]` never involves a JWT or a Membership at
 * all.
 *
 * `X-Api-Key` is looked up by its sha256 hash (never compared/stored in
 * plaintext), matching the RefreshToken hash-and-compare convention.
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly apiKeyRepository: ApiKeyRepository,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const rawKey = request.headers[API_KEY_HEADER];

    if (typeof rawKey !== 'string' || rawKey.length === 0) {
      throw new UnauthorizedException('Missing X-Api-Key header');
    }

    const apiKey = await this.apiKeyRepository.findActiveByHash(sha256Hex(rawKey));
    if (!apiKey) {
      throw new UnauthorizedException('Invalid, expired, or revoked API key');
    }

    void this.apiKeyRepository.touchLastUsedAt(apiKey.id);

    const principalId = `api-key:${apiKey.id}`;
    request.currentUser = {
      id: principalId,
      organizationId: apiKey.organizationId,
      membershipId: principalId,
      roles: ['api_key'],
      permissions: apiKey.scopedPermissions,
    };

    this.tenantContextService.set({
      organizationId: apiKey.organizationId,
      userId: principalId,
      membershipId: principalId,
    });

    return true;
  }
}
