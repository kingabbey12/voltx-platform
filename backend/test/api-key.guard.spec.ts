import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { TenantContextService } from '../src/common/tenant/tenant-context.service';
import { ApiKeyRepository } from '../src/modules/security/api-key.repository';
import { ApiKeyGuard } from '../src/modules/security/guards/api-key.guard';
import { sha256Hex } from '../src/modules/security/utils/security-hash.util';

function makeContext(headers: Record<string, string>): ExecutionContext {
  const request: Record<string, unknown> = { headers };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('ApiKeyGuard', () => {
  let guard: ApiKeyGuard;
  let apiKeyRepository: jest.Mocked<ApiKeyRepository>;
  let tenantContextService: jest.Mocked<TenantContextService>;

  beforeEach(() => {
    apiKeyRepository = {
      findActiveByHash: jest.fn(),
      touchLastUsedAt: jest.fn(),
    } as unknown as jest.Mocked<ApiKeyRepository>;
    tenantContextService = {
      set: jest.fn(),
    } as unknown as jest.Mocked<TenantContextService>;
    guard = new ApiKeyGuard(apiKeyRepository, tenantContextService);
  });

  it('rejects a request with no X-Api-Key header', async () => {
    const context = makeContext({});
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an unknown/revoked/expired key', async () => {
    apiKeyRepository.findActiveByHash.mockResolvedValue(null);
    const context = makeContext({ 'x-api-key': 'vk_bogus' });
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('resolves org/permission context from a valid key and seeds tenant context', async () => {
    const rawKey = 'vk_realkey';
    apiKeyRepository.findActiveByHash.mockResolvedValue({
      id: 'key-1',
      organizationId: 'org-1',
      createdByUserId: 'user-1',
      name: 'CI bot',
      keyHash: sha256Hex(rawKey),
      keyPrefix: 'vk_real...',
      scopedPermissions: ['sales.opportunity.read'],
      expiresAt: null,
      lastUsedAt: null,
      revokedAt: null,
      createdAt: new Date(),
    });

    const request: Record<string, unknown> = { headers: { 'x-api-key': rawKey } };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(apiKeyRepository.touchLastUsedAt).toHaveBeenCalledWith('key-1');
    expect(request.currentUser).toEqual({
      id: 'api-key:key-1',
      organizationId: 'org-1',
      membershipId: 'api-key:key-1',
      roles: ['api_key'],
      permissions: ['sales.opportunity.read'],
    });
    expect(tenantContextService.set).toHaveBeenCalledWith({
      organizationId: 'org-1',
      userId: 'api-key:key-1',
      membershipId: 'api-key:key-1',
    });
  });

  it('never grants permissions beyond scopedPermissions, regardless of org role permissions', async () => {
    const rawKey = 'vk_scoped';
    apiKeyRepository.findActiveByHash.mockResolvedValue({
      id: 'key-2',
      organizationId: 'org-1',
      createdByUserId: 'user-1',
      name: 'Narrow bot',
      keyHash: sha256Hex(rawKey),
      keyPrefix: 'vk_scop...',
      scopedPermissions: ['sales.opportunity.read'],
      expiresAt: null,
      lastUsedAt: null,
      revokedAt: null,
      createdAt: new Date(),
    });

    const request: Record<string, unknown> = { headers: { 'x-api-key': rawKey } };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    await guard.canActivate(context);

    const currentUser = request.currentUser as { permissions: string[] };
    expect(currentUser.permissions).not.toContain('organization.delete');
    expect(currentUser.permissions).toEqual(['sales.opportunity.read']);
  });
});
