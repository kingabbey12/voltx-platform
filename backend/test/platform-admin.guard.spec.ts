import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PlatformAdminGuard } from '../src/common/guards/platform-admin.guard';
import { UsersRepository } from '../src/modules/users/users.repository';

function contextWithUserId(userId: string | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ authPrincipal: userId ? { userId } : undefined }),
    }),
  } as unknown as ExecutionContext;
}

describe('PlatformAdminGuard', () => {
  let usersRepository: jest.Mocked<UsersRepository>;
  let guard: PlatformAdminGuard;

  beforeEach(() => {
    usersRepository = { findByIdUnscoped: jest.fn() } as never;
    guard = new PlatformAdminGuard(usersRepository);
  });

  it('allows a user with isPlatformAdmin true', async () => {
    usersRepository.findByIdUnscoped.mockResolvedValue({ isPlatformAdmin: true } as never);

    await expect(guard.canActivate(contextWithUserId('user-1'))).resolves.toBe(true);
  });

  it('denies a user with isPlatformAdmin false', async () => {
    usersRepository.findByIdUnscoped.mockResolvedValue({ isPlatformAdmin: false } as never);

    await expect(guard.canActivate(contextWithUserId('user-1'))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('denies when the user cannot be found', async () => {
    usersRepository.findByIdUnscoped.mockResolvedValue(null);

    await expect(guard.canActivate(contextWithUserId('user-1'))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('denies when there is no authenticated principal at all', async () => {
    await expect(guard.canActivate(contextWithUserId(undefined))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(usersRepository.findByIdUnscoped).not.toHaveBeenCalled();
  });
});
