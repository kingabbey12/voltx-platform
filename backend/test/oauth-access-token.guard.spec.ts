import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TenantContextService } from '../src/common/tenant/tenant-context.service';
import { AuthContextService } from '../src/modules/auth/auth-context.service';
import { OAuthAccessTokenGuard } from '../src/modules/oauth-provider/guards/oauth-access-token.guard';
import { OAuthTokenRepository } from '../src/modules/oauth-provider/oauth-token.repository';

function makeContext(headers: Record<string, string>): ExecutionContext {
  const request: Record<string, unknown> = { headers };
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('OAuthAccessTokenGuard', () => {
  let guard: OAuthAccessTokenGuard;
  let tokenRepository: jest.Mocked<OAuthTokenRepository>;
  let authContextService: jest.Mocked<AuthContextService>;
  let tenantContextService: jest.Mocked<TenantContextService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OAuthAccessTokenGuard,
        {
          provide: OAuthTokenRepository,
          useValue: { findActiveAccessTokenByHash: jest.fn() },
        },
        { provide: AuthContextService, useValue: { resolveCurrentUser: jest.fn() } },
        { provide: TenantContextService, useValue: { set: jest.fn() } },
      ],
    }).compile();

    guard = module.get(OAuthAccessTokenGuard);
    tokenRepository = module.get(OAuthTokenRepository);
    authContextService = module.get(AuthContextService);
    tenantContextService = module.get(TenantContextService);
  });

  it('rejects a request with no Authorization header', async () => {
    await expect(guard.canActivate(makeContext({}))).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a non-Bearer Authorization header', async () => {
    await expect(
      guard.canActivate(makeContext({ authorization: 'Basic dXNlcjpwYXNz' })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects a Bearer token that does not resolve to an active access token', async () => {
    tokenRepository.findActiveAccessTokenByHash.mockResolvedValue(null);
    await expect(
      guard.canActivate(makeContext({ authorization: 'Bearer voat_bad' })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects when the authorizing user is no longer an active member', async () => {
    tokenRepository.findActiveAccessTokenByHash.mockResolvedValue({
      id: 'access-1',
      applicationId: 'app-1',
      authorizingUserId: 'user-1',
      authorizingOrganizationId: 'org-1',
      scopes: ['sales.opportunity.read'],
    } as never);
    authContextService.resolveCurrentUser.mockResolvedValue(null);

    await expect(
      guard.canActivate(makeContext({ authorization: 'Bearer voat_good' })),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('narrows effective permissions to the intersection of the token scopes and the live membership', async () => {
    tokenRepository.findActiveAccessTokenByHash.mockResolvedValue({
      id: 'access-1',
      applicationId: 'app-1',
      authorizingUserId: 'user-1',
      authorizingOrganizationId: 'org-1',
      scopes: ['sales.opportunity.read'],
    } as never);
    authContextService.resolveCurrentUser.mockResolvedValue({
      id: 'user-1',
      organizationId: 'org-1',
      membershipId: 'membership-1',
      roles: ['member'],
      permissions: ['sales.opportunity.read', 'sales.opportunity.update', 'user.create'],
    });

    const context = makeContext({ authorization: 'Bearer voat_good' });
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    const request = context.switchToHttp().getRequest<{ currentUser: { permissions: string[] } }>();
    expect(request.currentUser.permissions).toEqual(['sales.opportunity.read']);
    expect(tenantContextService.set).toHaveBeenCalledWith({
      organizationId: 'org-1',
      userId: 'user-1',
      membershipId: 'membership-1',
    });
  });
});
