import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { VerificationTokenType } from '@prisma/client';
import { VerificationTokenRepository } from '../src/modules/auth/verification-token.repository';
import { VerificationTokenService } from '../src/modules/auth/verification-token.service';
import * as verificationTokenUtil from '../src/modules/auth/utils/verification-token.util';

describe('VerificationTokenService', () => {
  let service: VerificationTokenService;
  let repository: jest.Mocked<VerificationTokenRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerificationTokenService,
        {
          provide: VerificationTokenRepository,
          useValue: {
            create: jest.fn(),
            findValidByTokenHashAndType: jest.fn(),
            markUsed: jest.fn(),
            invalidateUnusedByUserAndType: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(VerificationTokenService);
    repository = module.get(VerificationTokenRepository);
  });

  it('issues and consumes an email verification token once', async () => {
    jest.spyOn(verificationTokenUtil, 'generateVerificationToken').mockReturnValue('verify-token');
    jest.spyOn(verificationTokenUtil, 'hashVerificationToken').mockReturnValue('verify-hash');
    jest
      .spyOn(verificationTokenUtil, 'getEmailVerificationExpiresAt')
      .mockReturnValue(new Date('2026-08-01'));

    repository.findValidByTokenHashAndType.mockResolvedValue({
      id: 'token-id',
      userId: 'user-id',
      tokenHash: 'verify-hash',
      type: VerificationTokenType.EMAIL_VERIFICATION,
      expiresAt: new Date('2026-08-01'),
      usedAt: null,
      createdAt: new Date(),
    });

    const issued = await service.issueEmailVerificationToken('user-id');
    expect(issued.token).toBe('verify-token');
    expect(repository.invalidateUnusedByUserAndType).toHaveBeenCalledWith(
      'user-id',
      VerificationTokenType.EMAIL_VERIFICATION,
    );
    expect(repository.create).toHaveBeenCalledWith(
      'user-id',
      'verify-hash',
      VerificationTokenType.EMAIL_VERIFICATION,
      new Date('2026-08-01'),
    );

    const consumed = await service.consumeEmailVerificationToken('verify-token');
    expect(consumed.userId).toBe('user-id');
    expect(repository.markUsed).toHaveBeenCalledWith('token-id');
  });

  it('rejects invalid verification tokens', async () => {
    repository.findValidByTokenHashAndType.mockResolvedValue(null);

    await expect(service.consumePasswordResetToken('invalid-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });
});
