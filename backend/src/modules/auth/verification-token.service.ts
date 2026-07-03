import { Injectable, UnauthorizedException } from '@nestjs/common';
import { VerificationTokenType } from '@prisma/client';
import {
  generateVerificationToken,
  getEmailVerificationExpiresAt,
  getPasswordResetExpiresAt,
  hashVerificationToken,
} from './utils/verification-token.util';
import { VerificationTokenRepository } from './verification-token.repository';

export interface IssuedVerificationToken {
  token: string;
}

@Injectable()
export class VerificationTokenService {
  constructor(private readonly verificationTokenRepository: VerificationTokenRepository) {}

  async issueEmailVerificationToken(userId: string): Promise<IssuedVerificationToken> {
    return this.issueToken(userId, VerificationTokenType.EMAIL_VERIFICATION);
  }

  async issuePasswordResetToken(userId: string): Promise<IssuedVerificationToken> {
    return this.issueToken(userId, VerificationTokenType.PASSWORD_RESET);
  }

  async consumeEmailVerificationToken(token: string): Promise<{ userId: string }> {
    return this.consumeToken(token, VerificationTokenType.EMAIL_VERIFICATION);
  }

  async consumePasswordResetToken(token: string): Promise<{ userId: string }> {
    return this.consumeToken(token, VerificationTokenType.PASSWORD_RESET);
  }

  async consumeToken(token: string, type: VerificationTokenType): Promise<{ userId: string }> {
    const tokenHash = hashVerificationToken(token);
    const storedToken = await this.verificationTokenRepository.findValidByTokenHashAndType(
      tokenHash,
      type,
    );

    if (!storedToken) {
      throw new UnauthorizedException('Invalid or expired verification token');
    }

    await this.verificationTokenRepository.markUsed(storedToken.id);

    return { userId: storedToken.userId };
  }

  private async issueToken(
    userId: string,
    type: VerificationTokenType,
  ): Promise<IssuedVerificationToken> {
    await this.verificationTokenRepository.invalidateUnusedByUserAndType(userId, type);

    const token = generateVerificationToken();
    const tokenHash = hashVerificationToken(token);
    const expiresAt =
      type === VerificationTokenType.EMAIL_VERIFICATION
        ? getEmailVerificationExpiresAt()
        : getPasswordResetExpiresAt();

    await this.verificationTokenRepository.create(userId, tokenHash, type, expiresAt);

    return { token };
  }
}
