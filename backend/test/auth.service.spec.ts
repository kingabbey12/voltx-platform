import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { UserStatus } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { AuthContextRepository } from '../src/modules/auth/auth-context.repository';
import { AuthRepository } from '../src/modules/auth/auth.repository';
import { AuthService } from '../src/modules/auth/auth.service';
import {
  LoginResponseDto,
  MfaChallengeResponseDto,
} from '../src/modules/auth/dto/auth-response.dto';
import { RefreshTokenRepository } from '../src/modules/auth/refresh-token.repository';
import { SessionRepository } from '../src/modules/auth/session.repository';
import { TrustedDeviceRepository } from '../src/modules/auth/trusted-device.repository';
import { VerificationTokenService } from '../src/modules/auth/verification-token.service';
import { OrganizationRepository } from '../src/modules/organization/organization.repository';
import { PrismaService } from '../src/database/prisma.service';
import { UsersRepository } from '../src/modules/users/users.repository';
import { AuditService } from '../src/modules/audit/audit.service';
import { MailService } from '../src/modules/mail/mail.service';
import { BillingAccountService } from '../src/modules/billing/billing-account.service';
import { PlanService } from '../src/modules/billing/plan.service';
import { SubscriptionService } from '../src/modules/billing/subscription.service';
import * as passwordUtil from '../src/modules/auth/utils/password.util';
import * as refreshTokenUtil from '../src/modules/auth/utils/refresh-token.util';

/** Narrows a login() result to LoginResponseDto, failing loudly if the
 * attempt was unexpectedly challenged for MFA instead. */
function expectLoginResponse(result: LoginResponseDto | MfaChallengeResponseDto): LoginResponseDto {
  if (!('user' in result)) {
    throw new Error('Expected a LoginResponseDto but got an MFA challenge');
  }
  return result;
}

describe('AuthService', () => {
  let service: AuthService;
  let authRepository: jest.Mocked<AuthRepository>;
  let refreshTokenRepository: jest.Mocked<RefreshTokenRepository>;
  let verificationTokenService: jest.Mocked<VerificationTokenService>;
  let authContextRepository: jest.Mocked<AuthContextRepository>;
  let usersRepository: jest.Mocked<UsersRepository>;
  let organizationRepository: jest.Mocked<OrganizationRepository>;
  let sessionRepository: jest.Mocked<SessionRepository>;
  let trustedDeviceRepository: jest.Mocked<TrustedDeviceRepository>;
  let auditService: jest.Mocked<AuditService>;
  let mailService: jest.Mocked<MailService>;
  let billingAccountService: jest.Mocked<BillingAccountService>;
  let planService: jest.Mocked<PlanService>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;
  let prismaService: {
    system: {
      organization: { findUnique: jest.Mock };
      role: { findUniqueOrThrow: jest.Mock };
      $transaction: jest.Mock;
    };
  };

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
            findByTokenHash: jest.fn(),
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
            setPlatformAdmin: jest.fn(),
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
              organization: {
                // evaluateMfaRequirement()'s org-policy lookup — {} settings
                // means "no security policy configured" (mfaRequired: false).
                findUnique: jest.fn().mockResolvedValue({ settings: {} }),
              },
              $transaction: jest.fn(),
            },
          },
        },
        {
          provide: SessionRepository,
          useValue: {
            create: jest.fn().mockResolvedValue({ id: 'session-id' }),
            touchLastActiveAt: jest.fn(),
            revoke: jest.fn(),
            findActiveById: jest.fn(),
          },
        },
        {
          provide: TrustedDeviceRepository,
          useValue: {
            isTrusted: jest.fn().mockResolvedValue(false),
          },
        },
        {
          provide: AuditService,
          useValue: {
            record: jest.fn(),
            recordWithExplicitActor: jest.fn(),
          },
        },
        {
          provide: MailService,
          useValue: {
            send: jest.fn(),
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
            get: jest.fn((key: string) => {
              if (key === 'billing.platformAdminEmails') return [];
              return '15m';
            }),
          },
        },
        {
          provide: BillingAccountService,
          useValue: {
            createForOrganization: jest.fn(),
          },
        },
        {
          provide: SubscriptionService,
          useValue: {
            createTrialSubscription: jest.fn(),
          },
        },
        {
          provide: PlanService,
          useValue: {
            getPlanByKeyOrThrow: jest.fn(),
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
    organizationRepository = module.get(OrganizationRepository);
    sessionRepository = module.get(SessionRepository);
    trustedDeviceRepository = module.get(TrustedDeviceRepository);
    auditService = module.get(AuditService);
    mailService = module.get(MailService);
    billingAccountService = module.get(BillingAccountService);
    planService = module.get(PlanService);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
    prismaService = module.get(PrismaService);
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
      mfaEnabled: false,
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
      isPlatformAdmin: false,
      mfaEnabled: false,
      lastLoginAt: null,
      emailVerifiedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    const result = expectLoginResponse(
      await service.login({
        email: 'jane.doe@example.com',
        password: 'SecurePassword123!',
        organizationId: 'org-id',
      }),
    );

    expect(result.accessToken).toBe('access-token');
    expect(result.refreshToken).toBe('refresh-token');
    expect(sessionRepository.create).toHaveBeenCalledWith({
      userId: 'user-id',
      organizationId: 'org-id',
      deviceFingerprint: undefined,
      ipAddress: undefined,
      userAgent: undefined,
    });
    expect(refreshTokenRepository.create).toHaveBeenCalledWith(
      'user-id',
      'refresh-hash',
      new Date('2026-08-01'),
      'session-id',
    );
    expect(authRepository.updateLastLoginAt).toHaveBeenCalledWith('user-id');
    expect(auditService.recordWithExplicitActor).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.login_succeeded',
        organizationId: 'org-id',
        userId: 'user-id',
      }),
    );
  });

  it('returns an MFA challenge instead of tokens when the user has MFA enabled', async () => {
    authRepository.findUserByEmail.mockResolvedValue({
      id: 'user-id',
      email: 'jane.doe@example.com',
      passwordHash: 'hash',
      status: UserStatus.ACTIVE,
      mfaEnabled: true,
    });
    jest.spyOn(passwordUtil, 'verifyPassword').mockResolvedValue(true);
    authContextRepository.findActiveMembershipContext.mockResolvedValue({
      id: 'membership-id',
      organizationId: 'org-id',
      userId: 'user-id',
      roleId: 'role-id',
      roleKey: 'admin',
      roleName: 'Admin',
    });
    jwtService.signAsync.mockResolvedValue('mfa-challenge-token');

    const result = await service.login({
      email: 'jane.doe@example.com',
      password: 'SecurePassword123!',
      organizationId: 'org-id',
    });

    expect('mfaRequired' in result && result.mfaRequired).toBe(true);
    expect((result as MfaChallengeResponseDto).mfaChallengeToken).toBe('mfa-challenge-token');
    expect(sessionRepository.create).not.toHaveBeenCalled();
    expect(jwtService.signAsync).toHaveBeenCalledWith(
      { sub: 'user-id', org: 'org-id', type: 'mfa_challenge' },
      expect.any(Object),
    );
  });

  it('skips the MFA challenge when the device is trusted', async () => {
    authRepository.findUserByEmail.mockResolvedValue({
      id: 'user-id',
      email: 'jane.doe@example.com',
      passwordHash: 'hash',
      status: UserStatus.ACTIVE,
      mfaEnabled: true,
    });
    jest.spyOn(passwordUtil, 'verifyPassword').mockResolvedValue(true);
    jest.spyOn(refreshTokenUtil, 'generateRefreshToken').mockReturnValue('refresh-token');
    jest.spyOn(refreshTokenUtil, 'hashRefreshToken').mockReturnValue('refresh-hash');
    jest
      .spyOn(refreshTokenUtil, 'getRefreshTokenExpiresAt')
      .mockReturnValue(new Date('2026-08-01'));
    authContextRepository.findActiveMembershipContext.mockResolvedValue({
      id: 'membership-id',
      organizationId: 'org-id',
      userId: 'user-id',
      roleId: 'role-id',
      roleKey: 'admin',
      roleName: 'Admin',
    });
    trustedDeviceRepository.isTrusted.mockResolvedValue(true);
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
      isPlatformAdmin: false,
      mfaEnabled: true,
      lastLoginAt: null,
      emailVerifiedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    const result = expectLoginResponse(
      await service.login({
        email: 'jane.doe@example.com',
        password: 'SecurePassword123!',
        organizationId: 'org-id',
        deviceFingerprint: 'device-1',
      }),
    );

    expect(trustedDeviceRepository.isTrusted).toHaveBeenCalledWith('user-id', 'org-id', 'device-1');
    expect(result.accessToken).toBe('access-token');
  });

  it('blocks login when the organization requires MFA but the user has not enrolled', async () => {
    authRepository.findUserByEmail.mockResolvedValue({
      id: 'user-id',
      email: 'jane.doe@example.com',
      passwordHash: 'hash',
      status: UserStatus.ACTIVE,
      mfaEnabled: false,
    });
    jest.spyOn(passwordUtil, 'verifyPassword').mockResolvedValue(true);
    authContextRepository.findActiveMembershipContext.mockResolvedValue({
      id: 'membership-id',
      organizationId: 'org-id',
      userId: 'user-id',
      roleId: 'role-id',
      roleKey: 'admin',
      roleName: 'Admin',
    });
    prismaService.system.organization.findUnique.mockResolvedValueOnce({
      settings: { security: { mfaRequired: true } },
    });

    await expect(
      service.login({
        email: 'jane.doe@example.com',
        password: 'SecurePassword123!',
        organizationId: 'org-id',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(sessionRepository.create).not.toHaveBeenCalled();
    expect(auditService.recordWithExplicitActor).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.login_blocked_mfa_required',
        organizationId: 'org-id',
        userId: 'user-id',
      }),
    );
  });

  describe('platform admin self-heal on login', () => {
    function mockSuccessfulLoginUpTo(profileOverrides: { isPlatformAdmin: boolean }) {
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
        mfaEnabled: false,
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
        isPlatformAdmin: profileOverrides.isPlatformAdmin,
        mfaEnabled: false,
        lastLoginAt: null,
        emailVerifiedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });
    }

    it('grants platform admin when the email is allow-listed and not yet granted', async () => {
      mockSuccessfulLoginUpTo({ isPlatformAdmin: false });
      configService.get.mockImplementation((key: string) => {
        if (key === 'billing.platformAdminEmails') return ['jane.doe@example.com'];
        return '15m';
      });
      usersRepository.setPlatformAdmin.mockResolvedValue({
        id: 'user-id',
        email: 'jane.doe@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
        avatarUrl: null,
        phoneNumber: null,
        jobTitle: null,
        status: UserStatus.ACTIVE,
        isPlatformAdmin: true,
        mfaEnabled: false,
        lastLoginAt: null,
        emailVerifiedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      const result = expectLoginResponse(
        await service.login({
          email: 'jane.doe@example.com',
          password: 'SecurePassword123!',
          organizationId: 'org-id',
        }),
      );

      expect(usersRepository.setPlatformAdmin).toHaveBeenCalledWith('user-id', true);
      expect(result.user.isPlatformAdmin).toBe(true);
    });

    it('revokes platform admin when the email is no longer allow-listed', async () => {
      mockSuccessfulLoginUpTo({ isPlatformAdmin: true });
      configService.get.mockImplementation((key: string) => {
        if (key === 'billing.platformAdminEmails') return [];
        return '15m';
      });
      usersRepository.setPlatformAdmin.mockResolvedValue({
        id: 'user-id',
        email: 'jane.doe@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
        avatarUrl: null,
        phoneNumber: null,
        jobTitle: null,
        status: UserStatus.ACTIVE,
        isPlatformAdmin: false,
        mfaEnabled: false,
        lastLoginAt: null,
        emailVerifiedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });

      const result = expectLoginResponse(
        await service.login({
          email: 'jane.doe@example.com',
          password: 'SecurePassword123!',
          organizationId: 'org-id',
        }),
      );

      expect(usersRepository.setPlatformAdmin).toHaveBeenCalledWith('user-id', false);
      expect(result.user.isPlatformAdmin).toBe(false);
    });

    it('does not call setPlatformAdmin when the flag already matches the allowlist', async () => {
      mockSuccessfulLoginUpTo({ isPlatformAdmin: false });
      configService.get.mockImplementation((key: string) => {
        if (key === 'billing.platformAdminEmails') return [];
        return '15m';
      });

      await service.login({
        email: 'jane.doe@example.com',
        password: 'SecurePassword123!',
        organizationId: 'org-id',
      });

      expect(usersRepository.setPlatformAdmin).not.toHaveBeenCalled();
    });
  });

  it('audits successful registration', async () => {
    jest.spyOn(passwordUtil, 'hashPassword').mockResolvedValue('hash');
    jest.spyOn(refreshTokenUtil, 'generateRefreshToken').mockReturnValue('refresh-token');
    jest.spyOn(refreshTokenUtil, 'hashRefreshToken').mockReturnValue('refresh-hash');
    jest
      .spyOn(refreshTokenUtil, 'getRefreshTokenExpiresAt')
      .mockReturnValue(new Date('2026-08-01'));

    authRepository.findUserByEmail.mockResolvedValue(null);
    organizationRepository.isSlugTaken.mockResolvedValue(false);
    verificationTokenService.issueEmailVerificationToken.mockResolvedValue({
      token: 'verify-token',
    });
    prismaService.system.role.findUniqueOrThrow.mockResolvedValue({ id: 'owner-role-id' });
    prismaService.system.$transaction.mockImplementation(
      (callback: (tx: unknown) => Promise<unknown>) =>
        callback({
          organization: { create: jest.fn().mockResolvedValue({ id: 'org-id' }) },
          user: {
            create: jest.fn().mockResolvedValue({ id: 'user-id', email: 'jane.doe@example.com' }),
          },
          membership: { create: jest.fn().mockResolvedValue({}) },
        }),
    );
    billingAccountService.createForOrganization.mockResolvedValue({
      id: 'billing-account-id',
      organizationId: 'org-id',
      stripeCustomerId: null,
      email: 'jane.doe@example.com',
      defaultPaymentMethodId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    planService.getPlanByKeyOrThrow.mockResolvedValue({
      id: 'plan-id',
      key: 'professional',
      name: 'Professional',
      description: null,
      stripeProductId: null,
      stripePriceIdMonthly: null,
      stripePriceIdYearly: null,
      priceMonthlyUsd: null,
      priceYearlyUsd: null,
      isActive: true,
      sortOrder: 0,
      trialDays: 14,
      createdAt: new Date(),
      updatedAt: new Date(),
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
      isPlatformAdmin: false,
      mfaEnabled: false,
      lastLoginAt: null,
      emailVerifiedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    await service.register({
      email: 'jane.doe@example.com',
      password: 'SecurePassword123!',
      firstName: 'Jane',
      lastName: 'Doe',
      organizationName: 'Acme Inc',
    });

    expect(mailService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'jane.doe@example.com',
        subject: 'Verify your email address',
      }),
    );
    expect(auditService.recordWithExplicitActor).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.register_succeeded',
        organizationId: 'org-id',
        userId: 'user-id',
      }),
    );
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
      sessionId: 'session-id',
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
    expect(sessionRepository.touchLastActiveAt).toHaveBeenCalledWith('session-id');
    expect(refreshTokenRepository.create).toHaveBeenCalledWith(
      'user-id',
      'refresh-hash',
      new Date('2026-08-01'),
      'session-id',
    );
    expect(result.accessToken).toBe('new-access-token');
    expect(result.refreshToken).toBe('new-refresh-token');
  });

  it('revokes the whole session on a replayed (already-rotated) refresh token', async () => {
    jest.spyOn(refreshTokenUtil, 'hashRefreshToken').mockReturnValue('stolen-hash');
    refreshTokenRepository.findValidByTokenHash.mockResolvedValue(null);
    refreshTokenRepository.findByTokenHash.mockResolvedValue({
      id: 'token-id',
      userId: 'user-id',
      tokenHash: 'stolen-hash',
      expiresAt: new Date('2026-08-01'),
      revokedAt: new Date('2026-07-01'),
      createdAt: new Date('2026-06-01'),
      sessionId: 'session-id',
    });
    authContextRepository.findActiveMembershipContext.mockResolvedValue({
      id: 'membership-id',
      organizationId: 'org-id',
      userId: 'user-id',
      roleId: 'role-id',
      roleKey: 'admin',
      roleName: 'Admin',
    });

    await expect(service.refresh('stolen-refresh-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(sessionRepository.revoke).toHaveBeenCalledWith('session-id');
    expect(auditService.recordWithExplicitActor).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.refresh_token_reuse_detected',
        organizationId: 'org-id',
        userId: 'user-id',
      }),
    );
  });

  it('does not flag reuse for a token that simply expired naturally', async () => {
    jest.spyOn(refreshTokenUtil, 'hashRefreshToken').mockReturnValue('expired-hash');
    refreshTokenRepository.findValidByTokenHash.mockResolvedValue(null);
    refreshTokenRepository.findByTokenHash.mockResolvedValue({
      id: 'token-id',
      userId: 'user-id',
      tokenHash: 'expired-hash',
      expiresAt: new Date('2026-01-01'),
      revokedAt: null,
      createdAt: new Date('2025-12-01'),
      sessionId: 'session-id',
    });

    await expect(service.refresh('expired-refresh-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(sessionRepository.revoke).not.toHaveBeenCalled();
    expect(auditService.recordWithExplicitActor).not.toHaveBeenCalled();
  });

  it('does not flag reuse for a refresh token hash that never existed', async () => {
    jest.spyOn(refreshTokenUtil, 'hashRefreshToken').mockReturnValue('garbage-hash');
    refreshTokenRepository.findValidByTokenHash.mockResolvedValue(null);
    refreshTokenRepository.findByTokenHash.mockResolvedValue(null);

    await expect(service.refresh('garbage-refresh-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    expect(sessionRepository.revoke).not.toHaveBeenCalled();
    expect(auditService.recordWithExplicitActor).not.toHaveBeenCalled();
  });

  it('revokes the token and audits logout', async () => {
    jest.spyOn(refreshTokenUtil, 'hashRefreshToken').mockReturnValue('refresh-hash');
    refreshTokenRepository.findValidByTokenHash.mockResolvedValue({
      id: 'token-id',
      userId: 'user-id',
      tokenHash: 'refresh-hash',
      expiresAt: new Date('2026-08-01'),
      revokedAt: null,
      createdAt: new Date(),
      sessionId: 'session-id',
    });
    sessionRepository.findActiveById.mockResolvedValue({
      id: 'session-id',
      userId: 'user-id',
      organizationId: 'org-id',
      deviceFingerprint: null,
      ipAddress: null,
      userAgent: null,
      lastActiveAt: new Date(),
      revokedAt: null,
      createdAt: new Date(),
    });

    await service.logout('user-id', 'refresh-token');

    expect(refreshTokenRepository.revokeById).toHaveBeenCalledWith('token-id');
    expect(auditService.recordWithExplicitActor).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.logout',
        organizationId: 'org-id',
        userId: 'user-id',
      }),
    );
  });

  it('audits switching organizations', async () => {
    authContextRepository.findActiveMembershipContext.mockResolvedValue({
      id: 'membership-id',
      organizationId: 'new-org-id',
      userId: 'user-id',
      roleId: 'role-id',
      roleKey: 'member',
      roleName: 'Member',
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
      isPlatformAdmin: false,
      mfaEnabled: false,
      lastLoginAt: null,
      emailVerifiedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    await service.switchOrganization(
      {
        id: 'user-id',
        organizationId: 'old-org-id',
        membershipId: 'old-membership-id',
        roles: [],
        permissions: [],
      },
      'new-org-id',
    );

    expect(auditService.recordWithExplicitActor).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.organization_switched',
        organizationId: 'new-org-id',
        userId: 'user-id',
        metadata: { fromOrganizationId: 'old-org-id' },
      }),
    );
  });

  it('verifies email and marks emailVerifiedAt', async () => {
    verificationTokenService.consumeEmailVerificationToken.mockResolvedValue({ userId: 'user-id' });
    authRepository.markEmailVerified.mockResolvedValue(new Date('2026-07-03T00:00:00.000Z'));
    authContextRepository.findActiveMembershipContext.mockResolvedValue({
      id: 'membership-id',
      organizationId: 'org-id',
      userId: 'user-id',
      roleId: 'role-id',
      roleKey: 'admin',
      roleName: 'Admin',
    });

    const result = await service.verifyEmail('verify-token');

    expect(result.message).toBe('Email verified successfully');
    expect(result.emailVerifiedAt).toBe('2026-07-03T00:00:00.000Z');
    expect(auditService.recordWithExplicitActor).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.email_verified',
        organizationId: 'org-id',
        userId: 'user-id',
      }),
    );
  });

  it('returns generic message for password reset requests', async () => {
    authRepository.findUserIdByEmail.mockResolvedValue('user-id');
    verificationTokenService.issuePasswordResetToken.mockResolvedValue({ token: 'reset-token' });
    authContextRepository.findActiveMembershipContext.mockResolvedValue({
      id: 'membership-id',
      organizationId: 'org-id',
      userId: 'user-id',
      roleId: 'role-id',
      roleKey: 'admin',
      roleName: 'Admin',
    });

    const result = await service.requestPasswordReset({ email: 'jane.doe@example.com' });

    expect(result.message).toBe('If the account exists, a password reset email has been sent.');
    expect(verificationTokenService.issuePasswordResetToken).toHaveBeenCalledWith('user-id');
    expect(mailService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'jane.doe@example.com',
        subject: 'Reset your Voltx password',
      }),
    );
    expect(auditService.recordWithExplicitActor).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.password_reset_requested',
        organizationId: 'org-id',
        userId: 'user-id',
      }),
    );
  });

  it('does not error or audit a password reset request for an unknown email', async () => {
    authRepository.findUserIdByEmail.mockResolvedValue(null);

    const result = await service.requestPasswordReset({ email: 'nobody@example.com' });

    expect(result.message).toBe('If the account exists, a password reset email has been sent.');
    expect(verificationTokenService.issuePasswordResetToken).not.toHaveBeenCalled();
    expect(auditService.recordWithExplicitActor).not.toHaveBeenCalled();
  });

  it('resets password and revokes refresh tokens', async () => {
    jest.spyOn(passwordUtil, 'hashPassword').mockResolvedValue('new-hash');
    verificationTokenService.consumePasswordResetToken.mockResolvedValue({ userId: 'user-id' });
    authContextRepository.findActiveMembershipContext.mockResolvedValue({
      id: 'membership-id',
      organizationId: 'org-id',
      userId: 'user-id',
      roleId: 'role-id',
      roleKey: 'admin',
      roleName: 'Admin',
    });

    const result = await service.resetPassword({
      token: 'reset-token',
      password: 'NewSecurePassword123!',
    });

    expect(result.message).toBe('Password reset successfully');
    expect(authRepository.setPasswordHash).toHaveBeenCalledWith('user-id', 'new-hash');
    expect(auditService.recordWithExplicitActor).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'auth.password_reset_completed',
        organizationId: 'org-id',
        userId: 'user-id',
      }),
    );
    expect(refreshTokenRepository.revokeAllByUserId).toHaveBeenCalledWith('user-id');
  });
});
