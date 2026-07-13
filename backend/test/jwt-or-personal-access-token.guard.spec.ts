import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TenantContextService } from '../src/common/tenant/tenant-context.service';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';
import { UserContextGuard } from '../src/modules/auth/guards/user-context.guard';
import { JwtOrPersonalAccessTokenGuard } from '../src/modules/developer-platform/guards/jwt-or-personal-access-token.guard';
import { PersonalAccessTokenGuard } from '../src/modules/developer-platform/guards/personal-access-token.guard';

function makeContext(request: Record<string, unknown>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as unknown as ExecutionContext;
}

describe('JwtOrPersonalAccessTokenGuard', () => {
  let guard: JwtOrPersonalAccessTokenGuard;
  let personalAccessTokenGuard: jest.Mocked<PersonalAccessTokenGuard>;
  let jwtAuthGuard: jest.Mocked<JwtAuthGuard>;
  let userContextGuard: jest.Mocked<UserContextGuard>;
  let tenantContextService: jest.Mocked<TenantContextService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtOrPersonalAccessTokenGuard,
        { provide: PersonalAccessTokenGuard, useValue: { canActivate: jest.fn() } },
        { provide: JwtAuthGuard, useValue: { canActivate: jest.fn() } },
        { provide: UserContextGuard, useValue: { canActivate: jest.fn() } },
        { provide: TenantContextService, useValue: { get: jest.fn(), set: jest.fn() } },
      ],
    }).compile();

    guard = module.get(JwtOrPersonalAccessTokenGuard);
    personalAccessTokenGuard = module.get(PersonalAccessTokenGuard);
    jwtAuthGuard = module.get(JwtAuthGuard);
    userContextGuard = module.get(UserContextGuard);
    tenantContextService = module.get(TenantContextService);
  });

  it('delegates entirely to PersonalAccessTokenGuard when X-Personal-Access-Token is present', async () => {
    personalAccessTokenGuard.canActivate.mockResolvedValue(true);
    const context = makeContext({ headers: { 'x-personal-access-token': 'vpat_x' } });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(personalAccessTokenGuard.canActivate).toHaveBeenCalledWith(context);
    expect(jwtAuthGuard.canActivate).not.toHaveBeenCalled();
  });

  it('propagates a rejection from PersonalAccessTokenGuard', async () => {
    personalAccessTokenGuard.canActivate.mockRejectedValue(new UnauthorizedException('bad token'));
    const context = makeContext({ headers: { 'x-personal-access-token': 'vpat_bad' } });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
  });

  it('falls through to the JWT + membership + tenant chain when no PAT header is present', async () => {
    jwtAuthGuard.canActivate.mockResolvedValue(true);
    userContextGuard.canActivate.mockResolvedValue(true);
    tenantContextService.get.mockReturnValue({ requestId: 'req-1' });

    const request = {
      headers: {},
      currentUser: { id: 'user-1', organizationId: 'org-1', membershipId: 'membership-1' },
      tenantJwtPrincipal: { userId: 'user-1', organizationId: 'org-1' },
    };
    const context = makeContext(request);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(jwtAuthGuard.canActivate).toHaveBeenCalledWith(context);
    expect(userContextGuard.canActivate).toHaveBeenCalledWith(context);
    expect(tenantContextService.set).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-1', userId: 'user-1' }),
    );
  });

  it('rejects a cross-tenant mismatch on the JWT path exactly like TenantGuard', async () => {
    jwtAuthGuard.canActivate.mockResolvedValue(true);
    userContextGuard.canActivate.mockResolvedValue(true);
    tenantContextService.get.mockReturnValue({ requestId: 'req-1' });

    const request = {
      headers: {},
      currentUser: { id: 'user-1', organizationId: 'org-1', membershipId: 'membership-1' },
      tenantJwtPrincipal: { userId: 'user-1', organizationId: 'org-DIFFERENT' },
    };

    await expect(guard.canActivate(makeContext(request))).rejects.toThrow(ForbiddenException);
  });

  it('returns false without throwing when JwtAuthGuard itself rejects the request', async () => {
    jwtAuthGuard.canActivate.mockResolvedValue(false);
    const context = makeContext({ headers: {} });

    const result = await guard.canActivate(context);

    expect(result).toBe(false);
    expect(userContextGuard.canActivate).not.toHaveBeenCalled();
  });
});
