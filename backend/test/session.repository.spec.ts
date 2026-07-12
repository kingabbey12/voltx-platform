import { PrismaService } from '../src/database/prisma.service';
import { SessionRepository } from '../src/modules/auth/session.repository';

interface SessionUpdateArgs {
  where: { id: string };
  data: { revokedAt: Date };
}

interface SessionUpdateManyArgs {
  where: { userId: string; organizationId: string; revokedAt: null };
  data: { revokedAt: Date };
}

interface RefreshTokenUpdateManyArgs {
  where: { sessionId: string | { in: string[] }; revokedAt?: null };
  data: { revokedAt: Date };
}

describe('SessionRepository', () => {
  describe('revoke', () => {
    it('revokes the session and every refresh token issued under it, in one transaction', async () => {
      const sessionUpdate = jest.fn<Promise<unknown>, [SessionUpdateArgs]>();
      const refreshTokenUpdateMany = jest.fn<Promise<unknown>, [RefreshTokenUpdateManyArgs]>();
      const tx = {
        session: { update: sessionUpdate },
        refreshToken: { updateMany: refreshTokenUpdateMany },
      };

      const prisma = {
        runInTransaction: jest.fn(async (fn: (tx: unknown) => Promise<void>) => fn(tx)),
      };

      const repository = new SessionRepository(prisma as unknown as PrismaService);
      await repository.revoke('session-1');

      expect(prisma.runInTransaction).toHaveBeenCalledTimes(1);

      const sessionUpdateArgs = sessionUpdate.mock.calls[0][0];
      expect(sessionUpdateArgs.where).toEqual({ id: 'session-1' });
      expect(sessionUpdateArgs.data.revokedAt).toBeInstanceOf(Date);

      const refreshTokenArgs = refreshTokenUpdateMany.mock.calls[0][0];
      expect(refreshTokenArgs.where).toEqual({ sessionId: 'session-1', revokedAt: null });
      expect(refreshTokenArgs.data.revokedAt).toBeInstanceOf(Date);
    });
  });

  describe('revokeAllForUserInOrganization', () => {
    it('revokes every active session and every refresh token under them for that user+org', async () => {
      const sessionFindMany = jest
        .fn()
        .mockResolvedValue([{ id: 'session-1' }, { id: 'session-2' }]);
      const sessionUpdateMany = jest.fn<Promise<unknown>, [SessionUpdateManyArgs]>();
      const refreshTokenUpdateMany = jest.fn<Promise<unknown>, [RefreshTokenUpdateManyArgs]>();
      const tx = {
        session: { updateMany: sessionUpdateMany },
        refreshToken: { updateMany: refreshTokenUpdateMany },
      };

      const prisma = {
        session: { findMany: sessionFindMany },
        runInTransaction: jest.fn(async (fn: (tx: unknown) => Promise<void>) => fn(tx)),
      };

      const repository = new SessionRepository(prisma as unknown as PrismaService);
      await repository.revokeAllForUserInOrganization('user-1', 'org-1');

      expect(sessionFindMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', organizationId: 'org-1', revokedAt: null },
        select: { id: true },
      });

      const sessionUpdateManyArgs = sessionUpdateMany.mock.calls[0][0];
      expect(sessionUpdateManyArgs.where).toEqual({
        userId: 'user-1',
        organizationId: 'org-1',
        revokedAt: null,
      });
      expect(sessionUpdateManyArgs.data.revokedAt).toBeInstanceOf(Date);

      const refreshTokenArgs = refreshTokenUpdateMany.mock.calls[0][0];
      expect(refreshTokenArgs.where).toEqual({ sessionId: { in: ['session-1', 'session-2'] } });
      expect(refreshTokenArgs.data.revokedAt).toBeInstanceOf(Date);
    });
  });
});
