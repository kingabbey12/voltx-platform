import { ForbiddenException } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';
import { TenantGuard } from '../src/common/tenant/tenant.guard';
import { TenantContextService } from '../src/common/tenant/tenant-context.service';
import { AuthenticatedRequest } from '../src/modules/auth/interfaces/authenticated-request.interface';

describe('TenantGuard', () => {
  let guard: TenantGuard;
  let tenantContextService: jest.Mocked<TenantContextService>;

  beforeEach(() => {
    tenantContextService = {
      get: jest.fn().mockReturnValue({ requestId: 'req-123' }),
      set: jest.fn(),
      getOrThrow: jest.fn(),
      run: jest.fn(),
      isComplete: jest.fn(),
      assertOrganizationAccess: jest.fn(),
    } as unknown as jest.Mocked<TenantContextService>;

    guard = new TenantGuard(tenantContextService);
  });

  function createContext(request: Partial<AuthenticatedRequest>): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as ExecutionContext;
  }

  it('allows access when JWT tenant matches membership context', () => {
    const request: Partial<AuthenticatedRequest> = {
      currentUser: {
        id: 'user-id',
        organizationId: 'org-id',
        membershipId: 'membership-id',
        roles: ['admin'],
        permissions: ['user.read'],
      },
      tenantJwtPrincipal: {
        userId: 'user-id',
        organizationId: 'org-id',
      },
    };

    expect(guard.canActivate(createContext(request))).toBe(true);
    expect(request.tenantContext).toEqual({
      organizationId: 'org-id',
      userId: 'user-id',
      membershipId: 'membership-id',
      requestId: 'req-123',
    });
  });

  it('denies cross-tenant organization access', () => {
    const request: Partial<AuthenticatedRequest> = {
      currentUser: {
        id: 'user-id',
        organizationId: 'org-a',
        membershipId: 'membership-id',
        roles: ['admin'],
        permissions: ['user.read'],
      },
      tenantJwtPrincipal: {
        userId: 'user-id',
        organizationId: 'org-b',
      },
    };

    expect(() => guard.canActivate(createContext(request))).toThrow(ForbiddenException);
  });
});
