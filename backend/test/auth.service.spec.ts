import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { UserStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { AuthContextRepository } from '../src/modules/auth/auth-context.repository';
import { AuthRepository } from '../src/modules/auth/auth.repository';
import { AuthService } from '../src/modules/auth/auth.service';
import { RefreshTokenRepository } from '../src/modules/auth/refresh-token.repository';
import { VerificationTokenService } from '../src/modules/auth/verification-token.service';
import { OrganizationRepository } from '../src/modules/organization/organization.repository';
import { PrismaService } from '../src/database/prisma.service';
import { UsersRepository } from '../src/modules/users/users.repository';
import * as passwordUtil from '../src/modules/auth/utils/password.util';
import * as refreshTokenUtil from '../src/modules/auth/utils/refresh-token.util';

describe('AuthService', () => {
  let service: AuthService;
  let authRepository: jest.Mocked<AuthRepository>;
  let refreshTokenRepository: jest.Mocked<RefreshTokenRepository>;
  let verificationTokenService: jest.Mocked<VerificationTokenService>;
  let authContextRepository: jest.Mocked<AuthContextRepository>;
  let usersRepository: jest.Mocked<UsersRepository>;
  let jwtService: jest.Mocked<JwtService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: AuthRepository,
          useValue: {
            findUserByEmail: jest.fn(),
            updateLastLoginAt: jest.fn(),
            findUserIdByEmail: jest.fn(),
            markEmailVerified: jest.fn(),
            setPasswordHash: jest.fn(),
          },
        },
        {
          provide: RefreshTokenRepository,
          useValue: {
            create: jest.fn(),
            findValidByTokenHash: jest.fn(),
            revokeById: jest.fn(),
            revokeAllByUserId: jest.fn(),
          },
        },
        {
          provide: VerificationTokenService,
          useValue: {
            consumeEmailVerificationToken: jest.fn(),
            consumePasswordResetToken: jest.fn(),
            issuePasswordResetToken: jest.fn(),
            issueEmailVerificationToken: jest.fn(),
          },
        },
        {
          provide: AuthContextRepository,
          useValue: {
            findActiveMembershipContext: jest.fn(),
          },
        },
        {
          provide: UsersRepository,
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: OrganizationRepository,
          useValue: {
            isSlugTaken: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            system: {
              role: {
                findUniqueOrThrow: jest.fn(),
              },
              $transaction: jest.fn(),
            },
          },
        },
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('15m'),
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    authRepository = module.get(AuthRepository);
    refreshTokenRepository = module.get(RefreshTokenRepository);
    verificationTokenService = module.get(VerificationTokenService);
    authContextRepository = module.get(AuthContextRepository);
    usersRepository = module.get(UsersRepository);
    jwtService = module.get(JwtService);
  });

  it('issues tokens on successful login', async () => {
    jest.spyOn(passwordUtil, 'verifyPassword').mockResolvedValue(true);
    jest.spyOn(refreshTokenUtil, 'generateRefreshToken').mockReturnValue('refresh-token');
    jest.spyOn(refreshTokenUtil, 'hashRefreshToken').mockReturnValue('refresh-hash');
    jest
      .spyOn(refreshTokenUtil, 'getRefreshTokenExpiresAt')
      .mockReturnValue(new Date('2026-08-01'));

    authRepository.findUserByEmail.mockResolvedValue({
      id: 'user-id',
      email: 'jane.doe@example.com',
      passwordHash: 'hash',
      status: UserStatus.ACTIVE,
    });
    authContextRepository.findActiveMembershipContext.mockResolvedValue({
      id: 'membership-id',
      organizationId: 'org-id',
      userId: 'user-id',
      roleId: 'role-id',
      roleKey: 'admin',
      roleName: 'Admin',
    });
    jwtService.signAsync.mockResolvedValue('access-token');
    usersRepository.findById.mockResolvedValue({
      id: 'user-id',
      email: 'jane.doe@example.com',
      firstName: 'Jane',
      lastName: 'Doe',
      avatarUrl: null,
      phoneNumber: null,
      jobTitle: null,
      status: UserStatus.ACTIVE,
      lastLoginAt: null,
      emailVerifiedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    const result = await service.login({
      email: 'jane.doe@example.com',
      password: 'SecurePassword123!',
      organizationId: 'org-id',
    });

    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBe('refresh-token');
    expect(refreshTokenRepository.create).toHaveBeenCalledWith(
      'user-id',
      'refresh-hash',
      new Date('2026-08-01'),
    );
    expect(authRepository.updateLastLoginAt).toHaveBeenCalledWith('user-id');
  });

  it('rejects login with invalid credentials', async () => {
    authRepository.findUserByEmail.mockResolvedValue(null);

    await expect(
      service.login({
        email: 'missing@example.com',
        password: 'SecurePassword123!',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rotates refresh tokens', async () => {
    jest.spyOn(refreshTokenUtil, 'hashRefreshToken').mockReturnValue('refresh-hash');
    jest.spyOn(refreshTokenUtil, 'generateRefreshToken').mockReturnValue('new-refresh-token');
    jest
      .spyOn(refreshTokenUtil, 'getRefreshTokenExpiresAt')
      .mockReturnValue(new Date('2026-08-01'));

    refreshTokenRepository.findValidByTokenHash.mockResolvedValue({
      id: 'token-id',
      userId: 'user-id',
      tokenHash: 'refresh-hash',
      expiresAt: new Date('2026-08-01'),
      revokedAt: null,
      createdAt: new Date(),
    });
    authContextRepository.findActiveMembershipContext.mockResolvedValue({
      id: 'membership-id',
      organizationId: 'org-id',
      userId: 'user-id',
      roleId: 'role-id',
      roleKey: 'admin',
      roleName: 'Admin',
    });
    jwtService.signAsync.mockResolvedValue('new-access-token');

    const result = await service.refresh('old-refresh-token');

    expect(refreshTokenRepository.revokeById).toHaveBeenCalledWith('token-id');
    expect(result.accessToken).toBe('new-access-token');
    expect(result.refreshToken).toBe('new-refresh-token');
  });

  it('verifies email and marks emailVerifiedAt', async () => {
    verificationTokenService.consumeEmailVerificationToken.mockResolvedValue({ userId: 'user-id' });
    authRepository.markEmailVerified.mockResolvedValue(new Date('2026-07-03T00:00:00.000Z'));

    const result = await service.verifyEmail('verify-token');

    expect(result.message).toBe('Email verified successfully');
    expect(result.emailVerifiedAt).toBe('2026-07-03T00:00:00.000Z');
  });

  it('returns generic message for password reset requests', async () => {
    authRepository.findUserIdByEmail.mockResolvedValue('user-id');

    const result = await service.requestPasswordReset({ email: 'jane.doe@example.com' });

    expect(result.message).toBe('If the account exists, a password reset email has been sent.');
    expect(verificationTokenService.issuePasswordResetToken).toHaveBeenCalledWith('user-id');
  });

  it('resets password and revokes refresh tokens', async () => {
    jest.spyOn(passwordUtil, 'hashPassword').mockResolvedValue('new-hash');
    verificationTokenService.consumePasswordResetToken.mockResolvedValue({ userId: 'user-id' });

    const result = await service.resetPassword({
      token: 'reset-token',
      password: 'NewSecurePassword123!',
    });

    expect(result.message).toBe('Password reset successfully');
    expect(authRepository.setPasswordHash).toHaveBeenCalledWith('user-id', 'new-hash');
    expect(refreshTokenRepository.revokeAllByUserId).toHaveBeenCalledWith('user-id');
  });
});
