import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { UserStatus } from '@prisma/client';
import { AuditService } from '../src/modules/audit/audit.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { SessionRepository } from '../src/modules/auth/session.repository';
import { TrustedDeviceRepository } from '../src/modules/auth/trusted-device.repository';
import { EncryptionService } from '../src/modules/integrations/security/encryption.service';
import { MetricsService } from '../src/modules/metrics/metrics.service';
import { MfaRepository } from '../src/modules/security/mfa.repository';
import { MfaService } from '../src/modules/security/mfa.service';
import { UsersRepository } from '../src/modules/users/users.repository';
import * as totpUtil from '../src/modules/security/utils/totp.util';

describe('MfaService', () => {
  let service: MfaService;
  let mfaRepository: jest.Mocked<MfaRepository>;
  let usersRepository: jest.Mocked<UsersRepository>;
  let jwtService: jest.Mocked<JwtService>;
  let authService: jest.Mocked<AuthService>;
  let sessionRepository: jest.Mocked<SessionRepository>;
  let trustedDeviceRepository: jest.Mocked<TrustedDeviceRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MfaService,
        {
          provide: MfaRepository,
          useValue: {
            findState: jest.fn(),
            setPendingSecret: jest.fn(),
            enable: jest.fn(),
            disable: jest.fn(),
            replaceBackupCodeHashes: jest.fn(),
            consumeBackupCodeHash: jest.fn(),
          },
        },
        {
          provide: UsersRepository,
          useValue: { findById: jest.fn() },
        },
        {
          provide: EncryptionService,
          useValue: {
            encrypt: jest.fn((value: string) => `enc(${value})`),
            decrypt: jest.fn((value: string) => value.replace(/^enc\(|\)$/g, '')),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, fallback: unknown) => {
              if (key === 'mfa.backupCodeCount') return 3;
              if (key === 'mfa.totpIssuer') return 'Voltx';
              if (key === 'mfa.trustedDeviceDefaultDays') return 30;
              return fallback;
            }),
          },
        },
        { provide: JwtService, useValue: { verifyAsync: jest.fn() } },
        { provide: AuthService, useValue: { buildLoginResponse: jest.fn() } },
        {
          provide: SessionRepository,
          useValue: { create: jest.fn().mockResolvedValue({ id: 'session-id' }) },
        },
        {
          provide: TrustedDeviceRepository,
          useValue: { upsertTrust: jest.fn() },
        },
        {
          provide: AuditService,
          useValue: { record: jest.fn(), recordWithExplicitActor: jest.fn() },
        },
        { provide: MetricsService, useValue: { recordMfaChallenge: jest.fn() } },
      ],
    }).compile();

    service = module.get(MfaService);
    mfaRepository = module.get(MfaRepository);
    usersRepository = module.get(UsersRepository);
    jwtService = module.get(JwtService);
    authService = module.get(AuthService);
    sessionRepository = module.get(SessionRepository);
    trustedDeviceRepository = module.get(TrustedDeviceRepository);
  });

  afterEach(() => jest.restoreAllMocks());

  describe('setup / verifySetup', () => {
    it('stores an encrypted pending secret and returns an otpauth URI', async () => {
      usersRepository.findById.mockResolvedValue({
        id: 'user-1',
        email: 'jane@example.com',
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
      jest.spyOn(totpUtil, 'generateTotpSecret').mockReturnValue('SECRETBASE32');
      jest.spyOn(totpUtil, 'generateTotpUri').mockReturnValue('otpauth://totp/Voltx:jane');

      const result = await service.setup('user-1');

      expect(mfaRepository.setPendingSecret).toHaveBeenCalledWith('user-1', 'enc(SECRETBASE32)');
      expect(result).toEqual({ secret: 'SECRETBASE32', otpauthUrl: 'otpauth://totp/Voltx:jane' });
    });

    it('rejects verifySetup when no setup was ever started', async () => {
      mfaRepository.findState.mockResolvedValue(null);
      await expect(service.verifySetup('user-1', '123456')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects verifySetup with an invalid TOTP code', async () => {
      mfaRepository.findState.mockResolvedValue({
        mfaEnabled: false,
        mfaSecret: 'enc(SECRETBASE32)',
        mfaBackupCodesHash: [],
      });
      jest.spyOn(totpUtil, 'verifyTotpCode').mockResolvedValue(false);

      await expect(service.verifySetup('user-1', '000000')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(mfaRepository.enable).not.toHaveBeenCalled();
    });

    it('enables MFA and returns backup codes on a valid code', async () => {
      mfaRepository.findState.mockResolvedValue({
        mfaEnabled: false,
        mfaSecret: 'enc(SECRETBASE32)',
        mfaBackupCodesHash: [],
      });
      jest.spyOn(totpUtil, 'verifyTotpCode').mockResolvedValue(true);

      const codes = await service.verifySetup('user-1', '123456');

      expect(codes).toHaveLength(3);
      expect(mfaRepository.enable).toHaveBeenCalledWith(
        'user-1',
        'enc(SECRETBASE32)',
        expect.arrayContaining([expect.any(String)]),
      );
      const [, , storedHashes] = mfaRepository.enable.mock.calls[0];
      expect(storedHashes).toHaveLength(3);
      // Backup codes are never stored in plaintext.
      expect(storedHashes.some((hash) => codes.includes(hash))).toBe(false);
    });
  });

  describe('disable', () => {
    it('throws if MFA is not enabled', async () => {
      mfaRepository.findState.mockResolvedValue({
        mfaEnabled: false,
        mfaSecret: null,
        mfaBackupCodesHash: [],
      });
      await expect(service.disable('user-1', '123456')).rejects.toBeInstanceOf(BadRequestException);
    });

    it('disables MFA with a valid TOTP code', async () => {
      mfaRepository.findState.mockResolvedValue({
        mfaEnabled: true,
        mfaSecret: 'enc(SECRETBASE32)',
        mfaBackupCodesHash: ['somehash'],
      });
      jest.spyOn(totpUtil, 'verifyTotpCode').mockResolvedValue(true);

      await service.disable('user-1', '123456');

      expect(mfaRepository.disable).toHaveBeenCalledWith('user-1');
    });

    it('rejects an invalid code and does not disable', async () => {
      mfaRepository.findState.mockResolvedValue({
        mfaEnabled: true,
        mfaSecret: 'enc(SECRETBASE32)',
        mfaBackupCodesHash: [],
      });
      jest.spyOn(totpUtil, 'verifyTotpCode').mockResolvedValue(false);

      await expect(service.disable('user-1', '000000')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(mfaRepository.disable).not.toHaveBeenCalled();
    });

    it('accepts a backup code (single-use) to disable MFA', async () => {
      mfaRepository.findState.mockResolvedValue({
        mfaEnabled: true,
        mfaSecret: 'enc(SECRETBASE32)',
        mfaBackupCodesHash: ['deadbeef'],
      });
      mfaRepository.consumeBackupCodeHash.mockResolvedValue(true);

      await service.disable('user-1', '7F3K-9QZC');

      expect(mfaRepository.consumeBackupCodeHash).toHaveBeenCalledWith(
        'user-1',
        expect.any(String),
      );
      expect(mfaRepository.disable).toHaveBeenCalledWith('user-1');
    });
  });

  describe('verifyLogin', () => {
    const challengePayload = { sub: 'user-1', org: 'org-1', type: 'mfa_challenge' as const };

    it('rejects an invalid/expired challenge token', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('expired'));

      await expect(
        service.verifyLogin({ challengeToken: 'bad-token', code: '123456' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(authService.buildLoginResponse).not.toHaveBeenCalled();
    });

    it('rejects a challenge token that is not type mfa_challenge', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: 'user-1',
        org: 'org-1',
        type: 'access',
      });

      await expect(
        service.verifyLogin({ challengeToken: 'access-token', code: '123456' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects an invalid TOTP/backup code and never issues tokens', async () => {
      jwtService.verifyAsync.mockResolvedValue(challengePayload);
      mfaRepository.findState.mockResolvedValue({
        mfaEnabled: true,
        mfaSecret: 'enc(SECRETBASE32)',
        mfaBackupCodesHash: [],
      });
      jest.spyOn(totpUtil, 'verifyTotpCode').mockResolvedValue(false);

      await expect(
        service.verifyLogin({ challengeToken: 'valid-challenge', code: '000000' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(sessionRepository.create).not.toHaveBeenCalled();
      expect(authService.buildLoginResponse).not.toHaveBeenCalled();
    });

    it('creates a session and completes login on a valid code', async () => {
      jwtService.verifyAsync.mockResolvedValue(challengePayload);
      mfaRepository.findState.mockResolvedValue({
        mfaEnabled: true,
        mfaSecret: 'enc(SECRETBASE32)',
        mfaBackupCodesHash: [],
      });
      jest.spyOn(totpUtil, 'verifyTotpCode').mockResolvedValue(true);
      authService.buildLoginResponse.mockResolvedValue({
        accessToken: 'access',
        refreshToken: 'refresh',
        tokenType: 'Bearer',
        expiresIn: 900,
        user: {} as never,
      });

      await service.verifyLogin(
        { challengeToken: 'valid-challenge', code: '123456' },
        { ipAddress: '1.2.3.4', userAgent: 'jest' },
      );

      expect(sessionRepository.create).toHaveBeenCalledWith({
        userId: 'user-1',
        organizationId: 'org-1',
        deviceFingerprint: undefined,
        ipAddress: '1.2.3.4',
        userAgent: 'jest',
      });
      expect(authService.buildLoginResponse).toHaveBeenCalledWith('user-1', 'org-1', 'session-id');
    });

    it('trusts the device when trustDevice is set', async () => {
      jwtService.verifyAsync.mockResolvedValue(challengePayload);
      mfaRepository.findState.mockResolvedValue({
        mfaEnabled: true,
        mfaSecret: 'enc(SECRETBASE32)',
        mfaBackupCodesHash: [],
      });
      jest.spyOn(totpUtil, 'verifyTotpCode').mockResolvedValue(true);
      authService.buildLoginResponse.mockResolvedValue({
        accessToken: 'access',
        refreshToken: 'refresh',
        tokenType: 'Bearer',
        expiresIn: 900,
        user: {} as never,
      });

      await service.verifyLogin({
        challengeToken: 'valid-challenge',
        code: '123456',
        deviceFingerprint: 'device-1',
        trustDevice: true,
        trustedForDays: 7,
      });

      expect(trustedDeviceRepository.upsertTrust).toHaveBeenCalledWith(
        'user-1',
        'org-1',
        'device-1',
        expect.any(Date),
      );
    });
  });
});
