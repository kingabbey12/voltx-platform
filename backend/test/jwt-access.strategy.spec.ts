import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { SupportSessionStatus } from '@prisma/client';
import { JwtAccessStrategy } from '../src/modules/auth/strategies/jwt-access.strategy';
import { SupportSessionRepository } from '../src/modules/auth/support-session.repository';

describe('JwtAccessStrategy', () => {
  let strategy: JwtAccessStrategy;
  let supportSessionRepository: jest.Mocked<SupportSessionRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtAccessStrategy,
        {
          provide: ConfigService,
          useValue: { getOrThrow: jest.fn().mockReturnValue('test-secret') },
        },
        { provide: SupportSessionRepository, useValue: { findById: jest.fn() } },
      ],
    }).compile();

    strategy = module.get(JwtAccessStrategy);
    supportSessionRepository = module.get(SupportSessionRepository);
  });

  it('accepts a normal access token with no supportSessionId claim', async () => {
    const result = await strategy.validate({ sub: 'user-1', org: 'org-1', type: 'access' });
    expect(result).toEqual({
      userId: 'user-1',
      organizationId: 'org-1',
      supportSessionId: undefined,
    });
    expect(supportSessionRepository.findById).not.toHaveBeenCalled();
  });

  it('rejects a token missing organization context', async () => {
    await expect(strategy.validate({ sub: 'user-1', type: 'access' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a non-access token type', async () => {
    await expect(
      strategy.validate({ sub: 'user-1', org: 'org-1', type: 'mfa_challenge' as never }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('accepts an impersonation token whose SupportSession is still ACTIVE and unexpired', async () => {
    supportSessionRepository.findById.mockResolvedValue({
      id: 'session-1',
      status: SupportSessionStatus.ACTIVE,
      expiresAt: new Date(Date.now() + 60_000),
    } as never);

    const result = await strategy.validate({
      sub: 'admin-1',
      org: 'org-1',
      type: 'access',
      supportSessionId: 'session-1',
    });

    expect(result).toEqual({
      userId: 'admin-1',
      organizationId: 'org-1',
      supportSessionId: 'session-1',
    });
  });

  it('rejects an impersonation token whose SupportSession has been ended early', async () => {
    supportSessionRepository.findById.mockResolvedValue({
      id: 'session-1',
      status: SupportSessionStatus.ENDED,
      expiresAt: new Date(Date.now() + 60_000),
    } as never);

    await expect(
      strategy.validate({
        sub: 'admin-1',
        org: 'org-1',
        type: 'access',
        supportSessionId: 'session-1',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an impersonation token whose SupportSession has passed its expiresAt', async () => {
    supportSessionRepository.findById.mockResolvedValue({
      id: 'session-1',
      status: SupportSessionStatus.ACTIVE,
      expiresAt: new Date(Date.now() - 1000),
    } as never);

    await expect(
      strategy.validate({
        sub: 'admin-1',
        org: 'org-1',
        type: 'access',
        supportSessionId: 'session-1',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects an impersonation token whose SupportSession no longer exists', async () => {
    supportSessionRepository.findById.mockResolvedValue(null);

    await expect(
      strategy.validate({
        sub: 'admin-1',
        org: 'org-1',
        type: 'access',
        supportSessionId: 'deleted-session',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
