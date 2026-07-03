import { Injectable } from '@nestjs/common';
import { VerificationTokenType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export interface VerificationTokenRecord {
  id: string;
  userId: string;
  tokenHash: string;
  type: VerificationTokenType;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class VerificationTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    tokenHash: string,
    type: VerificationTokenType,
    expiresAt: Date,
  ): Promise<VerificationTokenRecord> {
    return this.prisma.verificationToken.create({
      data: {
        userId,
        tokenHash,
        type,
        expiresAt,
      },
    });
  }

  async findValidByTokenHashAndType(
    tokenHash: string,
    type: VerificationTokenType,
  ): Promise<VerificationTokenRecord | null> {
    return this.prisma.verificationToken.findFirst({
      where: {
        tokenHash,
        type,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
  }

  async markUsed(id: string): Promise<void> {
    await this.prisma.verificationToken.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  }

  async invalidateUnusedByUserAndType(userId: string, type: VerificationTokenType): Promise<void> {
    await this.prisma.verificationToken.updateMany({
      where: {
        userId,
        type,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: { usedAt: new Date() },
    });
  }
}
