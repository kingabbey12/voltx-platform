import { BadRequestException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TenantContextService } from '../src/common/tenant/tenant-context.service';
import { AuthContextService } from '../src/modules/auth/auth-context.service';
import { PersonalAccessTokenGuard } from '../src/modules/developer-platform/guards/personal-access-token.guard';
import { PersonalAccessTokenRepository } from '../src/modules/developer-platform/personal-access-token.repository';

function makeContext(headers: Record<string, string>): ExecutionContext {
  const request: Record<string, unknown> = { headers };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('PersonalAccessTokenGuard', () => {
  let guard: PersonalAccessTokenGuard;
  let repository: jest.Mocked<PersonalAccessTokenRepository>;
  let authContextService: jest.Mocked<AuthContextService>;
  let tenantContextService: jest.Mocked<TenantContextService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PersonalAccessTokenGuard,
        {
          provide: PersonalAccessTokenRepository,
          useValue: { findActiveByHash: jest.fn(), touchLastUsedAt: jest.fn() },
        },
        { provide: AuthContextService, useValue: { resolveCurrentUser: jest.fn() } },
        { provide: TenantContextService, useValue: { set: jest.fn() } },
      ],
    }).compile();

    guard = module.get(PersonalAccessTokenGuard);
    repository = module.get(PersonalAccessTokenRepository);
    authContextService = module.get(AuthContextService);
    tenantContextService = module.get(TenantContextService);
  });

  it('rejects a request with no X-Personal-Access-Token header', async () => {
    await expect(guard.canActivate(makeContext({}))).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a token that does not resolve to an active PAT', async () => {
    repository.findActiveByHash.mockResolvedValue(null);
    await expect(
      guard.canActivate(makeContext({ 'x-personal-access-token': 'vpat_bad' })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a valid token with no X-Organization-Id header', async () => {
    repository.findActiveByHash.mockResolvedValue({
      id: 'pat-1',
      userId: 'user-1',
      scopedPermissions: ['organization.read'],
    } as never);

    await expect(
      guard.canActivate(makeContext({ 'x-personal-access-token': 'vpat_good' })),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects when the token owner is not an active member of the named organization', async () => {
    repository.findActiveByHash.mockResolvedValue({
      id: 'pat-1',
      userId: 'user-1',
      scopedPermissions: ['organization.read'],
    } as never);
    authContextService.resolveCurrentUser.mockResolvedValue(null);

    await expect(
      guard.canActivate(
        makeContext({ 'x-personal-access-token': 'vpat_good', 'x-organization-id': 'org-1' }),
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('narrows effective permissions to the intersection of the token and the live membership', async () => {
    repository.findActiveByHash.mockResolvedValue({
      id: 'pat-1',
      userId: 'user-1',
      scopedPermissions: ['organization.read'],
    } as never);
    authContextService.resolveCurrentUser.mockResolvedValue({
      id: 'user-1',
      organizationId: 'org-1',
      membershipId: 'membership-1',
      roles: ['member'],
      permissions: ['organization.read', 'organization.update', 'user.create'],
    });

    const context = makeContext({
      'x-personal-access-token': 'vpat_good',
      'x-organization-id': 'org-1',
    });
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    const request = context.switchToHttp().getRequest<{ currentUser: { permissions: string[] } }>();
    expect(request.currentUser.permissions).toEqual(['organization.read']);
    expect(tenantContextService.set).toHaveBeenCalledWith({
      organizationId: 'org-1',
      userId: 'user-1',
      membershipId: 'membership-1',
    });
    expect(repository.touchLastUsedAt).toHaveBeenCalledWith('pat-1');
  });
});
