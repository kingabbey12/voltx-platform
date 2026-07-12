import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { MembershipStatus, UserStatus } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { AuditService } from '../../audit/audit.service';
import {
  STORAGE_PROVIDER,
  StorageProvider,
} from '../../attachments/storage/storage-provider.interface';
import { LegalHoldRepository } from '../legal-hold/legal-hold.repository';
import { PII_REGISTRY } from '../pii/pii-registry';
import {
  PiiErasureOutcome,
  PiiExportSection,
  PiiRegistryService,
} from '../pii/pii-registry.service';

const EXCLUDED_FROM_ERASURE_SUMMARY = PII_REGISTRY.filter(
  (entry) => entry.erasure.kind === 'EXCLUDED',
).map(
  (entry) => `${entry.label}: ${entry.erasure.kind === 'EXCLUDED' ? entry.erasure.reason : ''}`,
);

const EXPORT_DOWNLOAD_URL_TTL_SECONDS = 60 * 15;

export interface GdprExportResult {
  organizationId: string;
  userId: string;
  exportedAt: string;
  downloadUrl: string;
  expiresAt: string;
  sections: { model: string; label: string; rowCount: number }[];
  excludedFromErasure: string[];
}

export interface GdprDeletionResult {
  organizationId: string;
  userId: string;
  results: PiiErasureOutcome[];
  globalIdentityScrubbed: boolean;
}

@Injectable()
export class GdprService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
    private readonly piiRegistryService: PiiRegistryService,
    private readonly legalHoldRepository: LegalHoldRepository,
    private readonly auditService: AuditService,
    @Inject(STORAGE_PROVIDER) private readonly storageProvider: StorageProvider,
  ) {}

  async exportUserData(targetUserId: string): Promise<GdprExportResult> {
    const tenant = this.tenantContextService.getOrThrow();
    await this.assertMembership(tenant.organizationId, targetUserId);

    const user = await this.prisma.system.user.findUniqueOrThrow({ where: { id: targetUserId } });
    const refreshTokenCount = await this.prisma.system.refreshToken.count({
      where: { userId: targetUserId },
    });

    const sections: PiiExportSection[] = await this.piiRegistryService.exportForUser(
      this.prisma.system,
      tenant.organizationId,
      targetUserId,
    );

    const payload = {
      exportedAt: new Date().toISOString(),
      organizationId: tenant.organizationId,
      profile: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        jobTitle: user.jobTitle,
        status: user.status,
        createdAt: user.createdAt.toISOString(),
      },
      activeSessionCount: refreshTokenCount,
      sections,
    };

    const storageKey = `compliance/gdpr-exports/${tenant.organizationId}/${targetUserId}-${randomUUID()}.json`;
    await this.storageProvider.upload(
      storageKey,
      Buffer.from(JSON.stringify(payload, null, 2), 'utf-8'),
      'application/json',
    );
    const downloadUrl = await this.storageProvider.getSignedDownloadUrl(
      storageKey,
      EXPORT_DOWNLOAD_URL_TTL_SECONDS,
      `gdpr-export-${targetUserId}.json`,
    );

    await this.auditService.record({
      action: 'compliance.gdpr.export',
      resource: 'user',
      resourceId: targetUserId,
      metadata: {
        sections: sections.map((section) => ({
          model: section.model,
          rowCount: section.rows.length,
        })),
      },
    });

    return {
      organizationId: tenant.organizationId,
      userId: targetUserId,
      exportedAt: payload.exportedAt,
      downloadUrl,
      expiresAt: new Date(Date.now() + EXPORT_DOWNLOAD_URL_TTL_SECONDS * 1000).toISOString(),
      sections: sections.map((section) => ({
        model: section.model,
        label: section.label,
        rowCount: section.rows.length,
      })),
      excludedFromErasure: EXCLUDED_FROM_ERASURE_SUMMARY,
    };
  }

  /**
   * Deletes/anonymizes a user's PII within the calling organization.
   * Org-scoped by design (this system's tenancy model is one global User
   * row shared across potentially many org Memberships) — see
   * PII_REGISTRY's doc comment and this phase's completion report for the
   * full reasoning. If, after this org's data is scrubbed, the user has no
   * remaining ACTIVE membership anywhere on the platform, the global User
   * identity (email/name/etc.) and all sessions are scrubbed too; otherwise
   * their account remains valid for their other organizations untouched.
   */
  async deleteUserData(targetUserId: string): Promise<GdprDeletionResult> {
    const tenant = this.tenantContextService.getOrThrow();
    await this.assertMembership(tenant.organizationId, targetUserId);

    const activeHold = await this.legalHoldRepository.findActiveForUser(
      tenant.organizationId,
      targetUserId,
    );
    if (activeHold) {
      throw new ConflictException(
        `Cannot erase this user's data: active legal hold "${activeHold.name}" blocks deletion`,
      );
    }

    const results = await this.piiRegistryService.eraseForUser(
      this.prisma.system,
      tenant.organizationId,
      targetUserId,
    );

    const remainingActiveMemberships = await this.prisma.system.membership.count({
      where: { userId: targetUserId, status: MembershipStatus.ACTIVE },
    });

    let globalIdentityScrubbed = false;
    if (remainingActiveMemberships === 0) {
      await this.scrubGlobalIdentity(targetUserId);
      globalIdentityScrubbed = true;
    }

    await this.auditService.record({
      action: 'compliance.gdpr.delete',
      resource: 'user',
      resourceId: targetUserId,
      metadata: {
        results: results.map((result) => ({
          model: result.model,
          action: result.action,
          affected: result.affected,
        })),
        globalIdentityScrubbed,
      },
    });

    return {
      organizationId: tenant.organizationId,
      userId: targetUserId,
      results,
      globalIdentityScrubbed,
    };
  }

  private async assertMembership(organizationId: string, userId: string): Promise<void> {
    const membership = await this.prisma.system.membership.findFirst({
      where: { organizationId, userId },
      select: { id: true },
    });
    if (!membership) {
      throw new NotFoundException('That user is not a member of this organization');
    }
  }

  private async scrubGlobalIdentity(userId: string): Promise<void> {
    await this.prisma.system.user.update({
      where: { id: userId },
      data: {
        email: `erased-${randomUUID()}@erased.invalid`,
        firstName: 'Redacted',
        lastName: 'User',
        phoneNumber: null,
        avatarUrl: null,
        jobTitle: null,
        passwordHash: null,
        notificationPreferences: {},
        status: UserStatus.INACTIVE,
        deletedAt: new Date(),
      },
    });
    await this.prisma.system.refreshToken.deleteMany({ where: { userId } });
    await this.prisma.system.verificationToken.deleteMany({ where: { userId } });
  }
}
