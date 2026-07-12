import { Test, TestingModule } from '@nestjs/testing';
import { AuditRepository } from '../src/modules/audit/audit.repository';
import { computeAuditLogHash } from '../src/modules/audit/audit-hash.util';
import { PrismaService } from '../src/database/prisma.service';
import { TenantContextService } from '../src/common/tenant/tenant-context.service';

interface FakeAuditLogRow {
  id: string;
  organizationId: string;
  userId: string;
  requestId: string;
  action: string;
  resource: string;
  resourceId: string | null;
  metadata: unknown;
  previousHash: string | null;
  hash: string | null;
  supportSessionId?: string | null;
  createdAt: Date;
}

/**
 * A minimal in-memory fake standing in for PrismaService, precise enough
 * to exercise AuditRepository's real transactional hash-chaining logic
 * (including the advisory-lock statement, which this fake just records)
 * without needing a live Postgres connection.
 */
function createFakePrisma() {
  const rows: FakeAuditLogRow[] = [];
  let nextId = 1;
  const executedRawStatements: unknown[] = [];

  const tx = {
    $executeRaw: (strings: TemplateStringsArray, ...values: unknown[]) => {
      executedRawStatements.push({ strings, values });
      return Promise.resolve(1);
    },
    auditLog: {
      // Mirrors the real orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] —
      // the id tiebreak matters because rows created within the same
      // millisecond (very plausible with JS's millisecond Date resolution,
      // even with writes serialized by the advisory lock) would otherwise
      // sort ambiguously.
      findFirst: (args: { where: { organizationId: string } }) => {
        const matches = rows
          .filter((row) => row.organizationId === args.where.organizationId)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (b.id > a.id ? 1 : -1));
        return Promise.resolve(matches[0] ?? null);
      },
      create: (args: { data: Omit<FakeAuditLogRow, 'id'> }) => {
        const row: FakeAuditLogRow = { id: `row-${nextId++}`, ...args.data };
        rows.push(row);
        return Promise.resolve(row);
      },
    },
  };

  const prisma = {
    runInTransaction: <T>(fn: (txArg: typeof tx) => Promise<T>) => fn(tx),
    auditLog: {
      findMany: (args: { where: { organizationId: string; hash?: unknown } }) =>
        Promise.resolve(
          rows
            .filter((row) => row.organizationId === args.where.organizationId)
            .filter((row) => (args.where.hash ? row.hash !== null : true))
            .sort(
              (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || (a.id > b.id ? 1 : -1),
            ),
        ),
    },
  };

  return { prisma, rows, executedRawStatements };
}

describe('AuditRepository — tamper-evident hash chain (v2.2 Compliance Center)', () => {
  let repository: AuditRepository;
  let fake: ReturnType<typeof createFakePrisma>;

  beforeEach(async () => {
    fake = createFakePrisma();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditRepository,
        { provide: PrismaService, useValue: fake.prisma },
        {
          provide: TenantContextService,
          useValue: {
            get: jest.fn().mockReturnValue({ requestId: 'req-1' }),
            getOrThrow: jest.fn().mockReturnValue({
              organizationId: 'org-1',
              userId: 'user-1',
              membershipId: 'membership-1',
              requestId: 'req-1',
            }),
          },
        },
      ],
    }).compile();

    repository = module.get(AuditRepository);
  });

  it('chains the first row in an organization with a null previousHash', async () => {
    await repository.create({ action: 'user.login', resource: 'user', resourceId: 'user-1' });

    expect(fake.rows).toHaveLength(1);
    expect(fake.rows[0].previousHash).toBeNull();
    expect(fake.rows[0].hash).toBeTruthy();
  });

  it("chains each subsequent row to the previous row's hash", async () => {
    await repository.create({ action: 'user.login', resource: 'user', resourceId: 'user-1' });
    await repository.create({ action: 'user.logout', resource: 'user', resourceId: 'user-1' });

    expect(fake.rows).toHaveLength(2);
    expect(fake.rows[1].previousHash).toBe(fake.rows[0].hash);
    expect(fake.rows[1].hash).not.toBe(fake.rows[0].hash);
  });

  it('acquires a per-organization advisory lock before reading the latest hash', async () => {
    await repository.create({ action: 'user.login', resource: 'user' });
    expect(fake.executedRawStatements).toHaveLength(1);
  });

  it('stamps supportSessionId from the tenant context onto rows written during an active support session', async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditRepository,
        { provide: PrismaService, useValue: fake.prisma },
        {
          provide: TenantContextService,
          useValue: {
            get: jest
              .fn()
              .mockReturnValue({ requestId: 'req-1', supportSessionId: 'support-session-1' }),
            getOrThrow: jest.fn().mockReturnValue({
              organizationId: 'org-1',
              userId: 'admin-1',
              membershipId: 'membership-1',
              requestId: 'req-1',
              supportSessionId: 'support-session-1',
            }),
          },
        },
      ],
    }).compile();
    const impersonatedRepository = module.get(AuditRepository);

    await impersonatedRepository.create({ action: 'lead.update', resource: 'lead' });

    expect(fake.rows).toHaveLength(1);
    expect(fake.rows[0].supportSessionId).toBe('support-session-1');
    expect(fake.rows[0].userId).toBe('admin-1');
  });

  it('leaves supportSessionId null for an ordinary (non-impersonated) action', async () => {
    await repository.create({ action: 'user.login', resource: 'user' });
    expect(fake.rows[0].supportSessionId ?? null).toBeNull();
  });

  it("keeps two organizations' chains independent", async () => {
    const tenantContextService = {
      get: jest.fn().mockReturnValue({ requestId: 'req-1' }),
      getOrThrow: jest
        .fn()
        .mockReturnValueOnce({
          organizationId: 'org-1',
          userId: 'user-1',
          membershipId: 'm-1',
          requestId: 'req-1',
        })
        .mockReturnValueOnce({
          organizationId: 'org-2',
          userId: 'user-2',
          membershipId: 'm-2',
          requestId: 'req-1',
        }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditRepository,
        { provide: PrismaService, useValue: fake.prisma },
        { provide: TenantContextService, useValue: tenantContextService },
      ],
    }).compile();
    const scopedRepository = module.get<AuditRepository>(AuditRepository);

    await scopedRepository.create({ action: 'a', resource: 'r' });
    await scopedRepository.create({ action: 'b', resource: 'r' });

    expect(fake.rows[0].organizationId).toBe('org-1');
    expect(fake.rows[1].organizationId).toBe('org-2');
    expect(fake.rows[1].previousHash).toBeNull(); // org-2's chain starts fresh, unaffected by org-1's chain
  });

  describe('verifyChain', () => {
    it('reports valid on an untampered chain', async () => {
      await repository.create({ action: 'a', resource: 'r' });
      await repository.create({ action: 'b', resource: 'r' });
      await repository.create({ action: 'c', resource: 'r' });

      const result = await repository.verifyChain('org-1');
      expect(result.valid).toBe(true);
      expect(result.checked).toBe(3);
      expect(result.brokenAtIndex).toBeNull();
    });

    it('detects a tampered row (content mutated without recomputing hash)', async () => {
      await repository.create({ action: 'a', resource: 'r' });
      await repository.create({ action: 'b', resource: 'r' });
      await repository.create({ action: 'c', resource: 'r' });

      // Simulate an attacker directly mutating a historical row's action in
      // the database without going through AuditRepository (which is the
      // only thing that would keep the hash consistent).
      fake.rows[1].action = 'tampered-action';

      const result = await repository.verifyChain('org-1');
      expect(result.valid).toBe(false);
      expect(result.brokenAtIndex).toBe(1);
      expect(result.brokenAuditLogId).toBe(fake.rows[1].id);
    });

    it('detects a deleted row (chain link no longer matches)', async () => {
      await repository.create({ action: 'a', resource: 'r' });
      await repository.create({ action: 'b', resource: 'r' });
      await repository.create({ action: 'c', resource: 'r' });

      // Simulate deleting the middle row outright.
      fake.rows.splice(1, 1);

      const result = await repository.verifyChain('org-1');
      expect(result.valid).toBe(false);
      expect(result.brokenAtIndex).toBe(1); // the surviving 3rd row's previousHash no longer matches the (now second) row's hash
    });

    it('skips legacy rows with a null hash rather than treating them as tampered', async () => {
      fake.rows.push({
        id: 'legacy-1',
        organizationId: 'org-1',
        userId: 'user-1',
        requestId: 'req-0',
        action: 'legacy.action',
        resource: 'legacy',
        resourceId: null,
        metadata: {},
        previousHash: null,
        hash: null,
        createdAt: new Date('2020-01-01T00:00:00.000Z'),
      });

      await repository.create({ action: 'a', resource: 'r' });

      const result = await repository.verifyChain('org-1');
      expect(result.valid).toBe(true);
      expect(result.checked).toBe(1); // only the one hash-chained row is checked
    });
  });
});

describe('computeAuditLogHash', () => {
  const baseInput = {
    organizationId: 'org-1',
    userId: 'user-1',
    requestId: 'req-1',
    action: 'user.login',
    resource: 'user',
    resourceId: null,
    metadata: { foo: 'bar', nested: { b: 2, a: 1 } },
    previousHash: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  it('is deterministic for identical input', () => {
    expect(computeAuditLogHash(baseInput)).toBe(computeAuditLogHash(baseInput));
  });

  it('is insensitive to metadata key ordering', () => {
    const reordered = { ...baseInput, metadata: { nested: { a: 1, b: 2 }, foo: 'bar' } };
    expect(computeAuditLogHash(baseInput)).toBe(computeAuditLogHash(reordered));
  });

  it('changes when any field changes', () => {
    const changed = { ...baseInput, action: 'user.logout' };
    expect(computeAuditLogHash(baseInput)).not.toBe(computeAuditLogHash(changed));
  });

  it('changes when previousHash changes (chaining)', () => {
    const chained = { ...baseInput, previousHash: 'some-prior-hash' };
    expect(computeAuditLogHash(baseInput)).not.toBe(computeAuditLogHash(chained));
  });
});
