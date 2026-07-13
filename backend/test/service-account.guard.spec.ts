import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ServiceAccountStatus } from '@prisma/client';
import { TenantContextService } from '../src/common/tenant/tenant-context.service';
import { AuthContextService } from '../src/modules/auth/auth-context.service';
import { ServiceAccountGuard } from '../src/modules/developer-platform/guards/service-account.guard';
import { ServiceAccountRepository } from '../src/modules/developer-platform/service-account.repository';

function makeContext(headers: Record<string, string>): ExecutionContext {
  const request: Record<string, unknown> = { headers };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('ServiceAccountGuard', () => {
  let guard: ServiceAccountGuard;
  let repository: jest.Mocked<ServiceAccountRepository>;
  let authContextService: jest.Mocked<AuthContextService>;
  let tenantContextService: jest.Mocked<TenantContextService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceAccountGuard,
        {
          provide: ServiceAccountRepository,
          useValue: {
            findActiveTokenByHash: jest.fn(),
            findByIdUnscoped: jest.fn(),
            touchTokenLastUsedAt: jest.fn(),
          },
        },
        { provide: AuthContextService, useValue: { resolveCurrentUser: jest.fn() } },
        { provide: TenantContextService, useValue: { set: jest.fn() } },
      ],
    }).compile();

    guard = module.get(ServiceAccountGuard);
    repository = module.get(ServiceAccountRepository);
    authContextService = module.get(AuthContextService);
    tenantContextService = module.get(TenantContextService);
  });

  it('rejects a request with no X-Service-Account-Token header', async () => {
    await expect(guard.canActivate(makeContext({}))).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an unknown/revoked/expired token', async () => {
    repository.findActiveTokenByHash.mockResolvedValue(null);
    await expect(
      guard.canActivate(makeContext({ 'x-service-account-token': 'vsa_bad' })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a token whose service account has been suspended', async () => {
    repository.findActiveTokenByHash.mockResolvedValue({
      id: 'token-1',
      serviceAccountId: 'sa-1',
    } as never);
    repository.findByIdUnscoped.mockResolvedValue({
      id: 'sa-1',
      status: ServiceAccountStatus.SUSPENDED,
      userId: 'user-synthetic-1',
      organizationId: 'org-1',
    } as never);

    await expect(
      guard.canActivate(makeContext({ 'x-service-account-token': 'vsa_good' })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects when the backing membership is no longer active', async () => {
    repository.findActiveTokenByHash.mockResolvedValue({
      id: 'token-1',
      serviceAccountId: 'sa-1',
    } as never);
    repository.findByIdUnscoped.mockResolvedValue({
      id: 'sa-1',
      status: ServiceAccountStatus.ACTIVE,
      userId: 'user-synthetic-1',
      organizationId: 'org-1',
    } as never);
    authContextService.resolveCurrentUser.mockResolvedValue(null);

    await expect(
      guard.canActivate(makeContext({ 'x-service-account-token': 'vsa_good' })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('authenticates via the live membership context and populates tenant context', async () => {
    repository.findActiveTokenByHash.mockResolvedValue({
      id: 'token-1',
      serviceAccountId: 'sa-1',
    } as never);
    repository.findByIdUnscoped.mockResolvedValue({
      id: 'sa-1',
      status: ServiceAccountStatus.ACTIVE,
      userId: 'user-synthetic-1',
      organizationId: 'org-1',
    } as never);
    authContextService.resolveCurrentUser.mockResolvedValue({
      id: 'user-synthetic-1',
      organizationId: 'org-1',
      membershipId: 'membership-1',
      roles: ['member'],
      permissions: ['workflow.run'],
    });

    const context = makeContext({ 'x-service-account-token': 'vsa_good' });
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(authContextService.resolveCurrentUser).toHaveBeenCalledWith('user-synthetic-1', 'org-1');
    expect(tenantContextService.set).toHaveBeenCalledWith({
      organizationId: 'org-1',
      userId: 'user-synthetic-1',
      membershipId: 'membership-1',
    });
    expect(repository.touchTokenLastUsedAt).toHaveBeenCalledWith('token-1');
  });
});
