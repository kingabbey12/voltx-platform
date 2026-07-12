import { ConfigService } from '@nestjs/config';
import { TenantContextService } from '../src/common/tenant/tenant-context.service';
import { PrismaService } from '../src/database/prisma.service';

function makeConfigService(overrides: Record<string, unknown> = {}): ConfigService {
  const values: Record<string, unknown> = {
    databaseUrl: 'postgresql://voltx:voltx@localhost:5433/voltx',
    ...overrides,
  };
  return {
    get: jest.fn((key: string, fallback?: unknown) => values[key] ?? fallback),
    getOrThrow: jest.fn((key: string) => {
      if (values[key] === undefined) {
        throw new Error(`Missing config key: ${key}`);
      }
      return values[key];
    }),
  } as unknown as ConfigService;
}

/**
 * v2.2 Platform Scale — proves PrismaService.replica is a true no-op
 * (an alias for the primary client, not a separate connection) when
 * DATABASE_REPLICA_URL is unset, which is every environment today. No
 * query is ever run here — constructing a PrismaClient doesn't open a
 * connection (that only happens on $connect()/the first query), so this
 * needs no live database.
 */
describe('PrismaService — replica routing point (v2.2 Platform Scale)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('replica is the exact same client as system when DATABASE_REPLICA_URL is unset', () => {
    const service = new PrismaService(new TenantContextService(), makeConfigService());

    expect(service.replica).toBe(service.system);
  });

  it('replica is a distinct client when DATABASE_REPLICA_URL is configured', () => {
    const service = new PrismaService(
      new TenantContextService(),
      makeConfigService({ 'database.replicaUrl': 'postgresql://voltx:voltx@localhost:5433/voltx' }),
    );

    expect(service.replica).not.toBe(service.system);
  });
});
