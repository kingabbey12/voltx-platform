import { Injectable } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export interface AuthUserRecord {
  id: string;
  email: string;
  passwordHash: string | null;
  status: UserStatus;
  mfaEnabled: boolean;
}

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUserByEmail(email: string): Promise<AuthUserRecord | null> {
    const record = await this.prisma.system.user.findFirst({
      where: { email: email.toLowerCase(), deletedAt: null },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        status: true,
        mfaEnabled: true,
      },
    });

    return record;
  }

  async updateLastLoginAt(userId: string): Promise<void> {
    await this.prisma.system.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  }

  async setPasswordHash(userId: string, passwordHash: string): Promise<void> {
    await this.prisma.system.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }

  async findUserIdByEmail(email: string): Promise<string | null> {
    const record = await this.prisma.system.user.findFirst({
      where: { email: email.toLowerCase(), deletedAt: null },
      select: { id: true },
    });

    return record?.id ?? null;
  }

  async markEmailVerified(userId: string): Promise<Date> {
    const emailVerifiedAt = new Date();
    await this.prisma.system.user.update({
      where: { id: userId },
      data: { emailVerifiedAt },
    });

    return emailVerifiedAt;
  }
}
