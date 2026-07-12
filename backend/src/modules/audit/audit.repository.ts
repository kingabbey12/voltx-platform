import { Injectable } from '@nestjs/common';
import { AuditLog, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { computeAuditLogHash } from './audit-hash.util';

export interface CreateAuditLogData {
  action: string;
  resource: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditChainVerificationResult {
  /** Number of hash-chained rows examined (rows written before this feature
   * existed have a null hash and are skipped, not counted as broken). */
  checked: number;
  valid: boolean;
  /** Zero-based index, among the checked rows in chain order, of the first
   * row whose stored hash no longer matches what the chain implies. */
  brokenAtIndex: number | null;
  brokenAuditLogId: string | null;
}

@Injectable()
export class AuditRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async create(data: CreateAuditLogData): Promise<void> {
    const tenant = this.tenantContextService.getOrThrow();
    await this.write({ ...data, organizationId: tenant.organizationId, userId: tenant.userId });
  }

  /** For the handful of legitimately unauthenticated actions worth
   * auditing (e.g. accepting an org invitation before any session exists)
   * where there is no JWT-derived tenant context to pull from. */
  async createWithExplicitActor(
    data: CreateAuditLogData & { organizationId: string; userId: string },
  ): Promise<void> {
    await this.write(data);
  }

  /**
   * Writes one AuditLog row and chains it into the per-organization
   * tamper-evident hash chain (v2.2 Compliance Center), inside the same
   * transaction as the insert — this is the single existing write path
   * every caller in the codebase already goes through (AuditService.record
   * / recordWithExplicitActor), so no parallel logging mechanism is needed.
   *
   * Concurrency safety: two requests for the same organization could
   * otherwise both read the same "latest" row, compute a previousHash from
   * it, and insert concurrently — forking the chain into two branches that
   * both claim the same parent. A Postgres transaction-scoped advisory lock
   * keyed by organizationId (pg_advisory_xact_lock, auto-released at
   * commit/rollback) serializes chain writes per organization: only one
   * transaction at a time can be reading "the latest hash" and inserting
   * the next link for a given org, so the chain can never fork. Different
   * organizations' chains are independent and never contend with each
   * other since the lock key is derived from organizationId.
   */
  private async write(
    data: CreateAuditLogData & { organizationId: string; userId: string },
  ): Promise<void> {
    const requestId = this.tenantContextService.get()?.requestId ?? 'unknown';
    const supportSessionId = this.tenantContextService.get()?.supportSessionId ?? null;
    const resourceId = data.resourceId ?? null;
    const metadata = (data.metadata ?? {}) as Prisma.InputJsonValue;

    await this.prisma.runInTransaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${data.organizationId}))`;

      const previous = await tx.auditLog.findFirst({
        where: { organizationId: data.organizationId },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        select: { hash: true },
      });
      const previousHash = previous?.hash ?? null;
      const createdAt = new Date();

      const hash = computeAuditLogHash({
        organizationId: data.organizationId,
        userId: data.userId,
        requestId,
        action: data.action,
        resource: data.resource,
        resourceId,
        metadata,
        previousHash,
        createdAt,
        supportSessionId,
      });

      await tx.auditLog.create({
        data: {
          organizationId: data.organizationId,
          userId: data.userId,
          requestId,
          action: data.action,
          resource: data.resource,
          resourceId,
          metadata,
          previousHash,
          hash,
          createdAt,
          supportSessionId,
        },
      });
    });
  }

  /** Org-scoped read for the Compliance Center's audit export — inclusive date range. */
  async findByDateRange(organizationId: string, fromDate: Date, toDate: Date): Promise<AuditLog[]> {
    return this.prisma.auditLog.findMany({
      where: { organizationId, createdAt: { gte: fromDate, lte: toDate } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  /**
   * Walks one organization's AuditLog rows in chain order and recomputes
   * each hash from its stored content + previousHash, comparing against
   * what's stored. Rows written before the hash-chain feature existed
   * (hash === null) are skipped rather than treated as tampered/broken.
   */
  async verifyChain(organizationId: string): Promise<AuditChainVerificationResult> {
    const rows = await this.prisma.auditLog.findMany({
      where: { organizationId, hash: { not: null } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    let expectedPreviousHash: string | null = null;

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];

      if (row.previousHash !== expectedPreviousHash) {
        return {
          checked: rows.length,
          valid: false,
          brokenAtIndex: index,
          brokenAuditLogId: row.id,
        };
      }

      const recomputedHash = computeAuditLogHash({
        organizationId: row.organizationId,
        userId: row.userId,
        requestId: row.requestId,
        action: row.action,
        resource: row.resource,
        resourceId: row.resourceId,
        metadata: row.metadata,
        previousHash: row.previousHash,
        createdAt: row.createdAt,
        supportSessionId: row.supportSessionId,
      });

      if (recomputedHash !== row.hash) {
        return {
          checked: rows.length,
          valid: false,
          brokenAtIndex: index,
          brokenAuditLogId: row.id,
        };
      }

      expectedPreviousHash = row.hash;
    }

    return { checked: rows.length, valid: true, brokenAtIndex: null, brokenAuditLogId: null };
  }
}
