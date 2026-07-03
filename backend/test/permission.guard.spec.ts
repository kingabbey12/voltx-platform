import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ExecutionContext } from '@nestjs/common/interfaces';
import { PermissionGuard } from '../src/modules/permissions/guards/permission.guard';
import { PERMISSIONS_METADATA_KEY } from '../src/modules/permissions/constants/permissions-metadata.constants';

describe('PermissionGuard', () => {
  let guard: PermissionGuard;
  let reflector: jest.Mocked<Pick<Reflector, 'getAllAndOverride'>>;

  const createContext = (currentUser?: { permissions: string[] }): ExecutionContext =>
    ({
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ currentUser }),
      }),
    }) as ExecutionContext;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    };
    guard = new PermissionGuard(reflector as unknown as Reflector);
  });

  it('allows access when no permissions are required', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    expect(guard.canActivate(createContext())).toBe(true);
  });

  it('allows access when user has required permissions', () => {
    reflector.getAllAndOverride.mockReturnValue(['user.read']);
    const context = createContext({ permissions: ['user.read', 'user.update'] });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('throws ForbiddenException when permission is missing', () => {
    reflector.getAllAndOverride.mockReturnValue(['organization.delete']);
    const context = createContext({ permissions: ['organization.read'] });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('throws UnauthorizedException when current user is missing', () => {
    reflector.getAllAndOverride.mockReturnValue(['user.read']);

    expect(() => guard.canActivate(createContext())).toThrow(UnauthorizedException);
  });

  it('reads permissions metadata key', () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    guard.canActivate(createContext({ permissions: [] }));

    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(PERMISSIONS_METADATA_KEY, [
      expect.anything(),
      expect.anything(),
    ]);
  });
});
