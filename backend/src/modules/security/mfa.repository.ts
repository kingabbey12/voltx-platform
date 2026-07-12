import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface MfaState {
  mfaEnabled: boolean;
  mfaSecret: string | null;
  mfaBackupCodesHash: string[];
}

/**
 * Reads/writes the MFA columns added to User in v2.2. Uses
 * `prisma.system.user` (unscoped), matching AuthRepository's convention for
 * auth-domain user access — MFA state must be readable/writable regardless
 * of tenant context (e.g. during the pre-JWT MFA-verify-login flow, where no
 * tenant context exists yet).
 */
@Injectable()
export class MfaRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findState(userId: string): Promise<MfaState | null> {
    return this.prisma.system.user.findUnique({
      where: { id: userId },
      select: { mfaEnabled: true, mfaSecret: true, mfaBackupCodesHash: true },
    });
  }

  async setPendingSecret(userId: string, encryptedSecret: string): Promise<void> {
    await this.prisma.system.user.update({
      where: { id: userId },
      data: { mfaSecret: encryptedSecret },
    });
  }

  async enable(userId: string, encryptedSecret: string, backupCodeHashes: string[]): Promise<void> {
    await this.prisma.system.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: true,
        mfaSecret: encryptedSecret,
        mfaBackupCodesHash: backupCodeHashes,
      },
    });
  }

  async disable(userId: string): Promise<void> {
    await this.prisma.system.user.update({
      where: { id: userId },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        mfaBackupCodesHash: [],
      },
    });
  }

  async replaceBackupCodeHashes(userId: string, backupCodeHashes: string[]): Promise<void> {
    await this.prisma.system.user.update({
      where: { id: userId },
      data: { mfaBackupCodesHash: backupCodeHashes },
    });
  }

  /** Atomically consumes a single-use backup code: the WHERE clause
   * re-checks the hash is still present in the array at update time, so a
   * concurrent double-spend of the same code has at most one winner. */
  async consumeBackupCodeHash(userId: string, codeHash: string): Promise<boolean> {
    const state = await this.findState(userId);
    if (!state || !state.mfaBackupCodesHash.includes(codeHash)) {
      return false;
    }

    const remaining = state.mfaBackupCodesHash.filter((hash) => hash !== codeHash);
    const result = await this.prisma.system.user.updateMany({
      where: { id: userId, mfaBackupCodesHash: { has: codeHash } },
      data: { mfaBackupCodesHash: remaining },
    });

    return result.count > 0;
  }
}
