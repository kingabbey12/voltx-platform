import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface TrustedDeviceRecord {
  id: string;
  userId: string;
  organizationId: string;
  deviceFingerprint: string;
  label: string | null;
  lastSeenAt: Date;
  trustedUntil: Date;
  revokedAt: Date | null;
  createdAt: Date;
}

/**
 * Lives in the auth module for the same reason as SessionRepository: the
 * MFA-skip check it backs is read directly inside AuthService.login(),
 * before any Security Center endpoint is involved. The Security Center's
 * trusted-device CRUD (`src/modules/security/`) injects this repository
 * directly (AuthModule is @Global()).
 */
@Injectable()
export class TrustedDeviceRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** True if this exact (user, device) pair has an active, unexpired trust
   * record — the MFA-skip check `AuthService.login()` consults. */
  async isTrusted(
    userId: string,
    organizationId: string,
    deviceFingerprint: string,
  ): Promise<boolean> {
    const record = await this.prisma.trustedDevice.findFirst({
      where: {
        userId,
        organizationId,
        deviceFingerprint,
        revokedAt: null,
        trustedUntil: { gt: new Date() },
      },
      select: { id: true },
    });
    return record !== null;
  }

  /** Upserts so re-trusting an already-trusted device extends the window
   * rather than creating a duplicate row (enforced by the @@unique on
   * [userId, deviceFingerprint]). */
  async upsertTrust(
    userId: string,
    organizationId: string,
    deviceFingerprint: string,
    trustedUntil: Date,
    label?: string,
  ): Promise<TrustedDeviceRecord> {
    return this.prisma.trustedDevice.upsert({
      where: { userId_deviceFingerprint: { userId, deviceFingerprint } },
      create: {
        userId,
        organizationId,
        deviceFingerprint,
        label,
        trustedUntil,
        lastSeenAt: new Date(),
      },
      update: {
        trustedUntil,
        revokedAt: null,
        lastSeenAt: new Date(),
        label,
      },
    });
  }

  async listActiveForUserInOrganization(
    userId: string,
    organizationId: string,
  ): Promise<TrustedDeviceRecord[]> {
    return this.prisma.trustedDevice.findMany({
      where: { userId, organizationId, revokedAt: null },
      orderBy: { lastSeenAt: 'desc' },
    });
  }

  async findByIdForUserInOrganization(
    id: string,
    userId: string,
    organizationId: string,
  ): Promise<TrustedDeviceRecord | null> {
    return this.prisma.trustedDevice.findFirst({
      where: { id, userId, organizationId },
    });
  }

  async revoke(id: string): Promise<void> {
    await this.prisma.trustedDevice.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }
}
