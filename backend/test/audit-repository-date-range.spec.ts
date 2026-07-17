import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuditRepository } from '../src/modules/audit/audit.repository';
import { PrismaService } from '../src/database/prisma.service';
import { TenantContextService } from '../src/common/tenant/tenant-context.service';

interface FakeRow {
  id: string;
  organizationId: string;
  createdAt: Date;
}

/**
 * Minimal in-memory fake exercising the same keyset-pagination shape
 * (createdAt/id ordering, `take`, and an OR-based `(createdAt, id)` cursor)
 * that AuditRepository.findByDateRange actually issues against Prisma —
 * enough to prove the batching loop pages through all rows correctly
 * without needing a live Postgres connection.
 */
function createFakePrisma(rows: FakeRow[]) {
  const findManyCalls: unknown[] = [];

  const prisma = {
    auditLog: {
      findMany: (args: {
        where: {
          organizationId: string;
          createdAt: { gte: Date; lte: Date };
          OR?: Array<{ createdAt: Date | { gt: Date }; id?: { gt: string } }>;
        };
        take: number;
      }) => {
        findManyCalls.push(args);
        let matches = rows.filter(
          (row) =>
            row.organizationId === args.where.organizationId &&
            row.createdAt >= args.where.createdAt.gte &&
            row.createdAt <= args.where.createdAt.lte,
        );

        if (args.where.OR) {
          const [afterClause, tieClause] = args.where.OR;
          const cursorTime = (afterClause.createdAt as { gt: Date }).gt;
          const cursorId = tieClause.id!.gt;
          matches = matches.filter(
            (row) =>
              row.createdAt.getTime() > cursorTime.getTime() ||
              (row.createdAt.getTime() === cursorTime.getTime() && row.id > cursorId),
          );
        }

        matches = matches
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || (a.id > b.id ? 1 : -1))
          .slice(0, args.take);

        return Promise.resolve(matches);
      },
    },
  };

  return { prisma, findManyCalls };
}

describe('AuditRepository.findByDateRange — keyset pagination', () => {
  let originalBatchSize: number;
  let originalMaxRows: number;

  beforeEach(() => {
    const repoStatics = AuditRepository as unknown as Record<string, number>;
    originalBatchSize = repoStatics.EXPORT_BATCH_SIZE;
    originalMaxRows = repoStatics.EXPORT_MAX_ROWS;
  });

  afterEach(() => {
    const repoStatics = AuditRepository as unknown as Record<string, number>;
    repoStatics.EXPORT_BATCH_SIZE = originalBatchSize;
    repoStatics.EXPORT_MAX_ROWS = originalMaxRows;
  });

  async function buildRepository(): Promise<AuditRepository> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditRepository,
        { provide: PrismaService, useValue: {} },
        { provide: TenantContextService, useValue: { get: jest.fn(), getOrThrow: jest.fn() } },
      ],
    }).compile();
    return module.get(AuditRepository);
  }

  it('pages through multiple batches and returns every row in order', async () => {
    const rows: FakeRow[] = Array.from({ length: 7 }, (_, i) => ({
      id: `row-${i}`,
      organizationId: 'org-1',
      createdAt: new Date(2026, 0, 1, 0, 0, i),
    }));
    const { prisma, findManyCalls } = createFakePrisma(rows);

    const repository = await buildRepository();
    (repository as unknown as { prisma: unknown }).prisma = prisma;
    (AuditRepository as unknown as Record<string, number>).EXPORT_BATCH_SIZE = 3;

    const result = await repository.findByDateRange(
      'org-1',
      new Date(2026, 0, 1),
      new Date(2026, 0, 2),
    );

    expect(result.map((r) => r.id)).toEqual(rows.map((r) => r.id));
    // 7 rows at batch size 3 => batches of 3, 3, 1 — the final short batch ends the loop
    expect(findManyCalls.length).toBe(3);
  });

  it('throws BadRequestException once the row count exceeds the safety cap', async () => {
    const rows: FakeRow[] = Array.from({ length: 6 }, (_, i) => ({
      id: `row-${i}`,
      organizationId: 'org-1',
      createdAt: new Date(2026, 0, 1, 0, 0, i),
    }));
    const { prisma } = createFakePrisma(rows);

    const repository = await buildRepository();
    (repository as unknown as { prisma: unknown }).prisma = prisma;
    (AuditRepository as unknown as Record<string, number>).EXPORT_BATCH_SIZE = 3;
    (AuditRepository as unknown as Record<string, number>).EXPORT_MAX_ROWS = 5;

    await expect(
      repository.findByDateRange('org-1', new Date(2026, 0, 1), new Date(2026, 0, 2)),
    ).rejects.toThrow(BadRequestException);
  });

  it('returns an empty array when nothing is in range', async () => {
    const { prisma } = createFakePrisma([]);
    const repository = await buildRepository();
    (repository as unknown as { prisma: unknown }).prisma = prisma;

    const result = await repository.findByDateRange(
      'org-1',
      new Date(2026, 0, 1),
      new Date(2026, 0, 2),
    );

    expect(result).toEqual([]);
  });
});
