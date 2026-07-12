import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, PrismaClient } from '@prisma/client';
import { TenantContextService } from '../common/tenant/tenant-context.service';
import { createTenantPrismaExtension } from './tenant-prisma.extension';

type PrismaTransactionClient = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'
>;

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly baseClient: PrismaClient;
  private readonly scopedClient: PrismaClient;
  private readonly transactionOptions: {
    maxWait: number;
    timeout: number;
    isolationLevel: Prisma.TransactionIsolationLevel;
  };

  constructor(tenantContextService: TenantContextService, configService: ConfigService) {
    this.transactionOptions = {
      maxWait: configService.get<number>('database.transactionMaxWaitMs', 5000),
      timeout: configService.get<number>('database.transactionTimeoutMs', 10000),
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
    };

    const prismaLogLevels: Prisma.LogLevel[] = ['warn', 'error'];
    if (configService.get<boolean>('database.queryLoggingEnabled', false)) {
      prismaLogLevels.push('query');
    }

    this.baseClient = new PrismaClient({
      datasourceUrl: buildDatabaseConnectionUrl(
        configService.getOrThrow<string>('databaseUrl'),
        configService.get<number>('database.connectionLimit', 10),
        configService.get<number>('database.poolTimeoutSeconds', 10),
      ),
      log: prismaLogLevels,
    });
    this.scopedClient = this.baseClient.$extends(
      createTenantPrismaExtension(tenantContextService),
    ) as unknown as PrismaClient;
  }

  /** Unscoped client for authentication and system-level operations. */
  get system(): PrismaClient {
    return this.baseClient;
  }

  get organization(): PrismaClient['organization'] {
    return this.scopedClient.organization;
  }

  get user(): PrismaClient['user'] {
    return this.scopedClient.user;
  }

  get membership(): PrismaClient['membership'] {
    return this.scopedClient.membership;
  }

  get auditLog(): PrismaClient['auditLog'] {
    return this.scopedClient.auditLog;
  }

  get role(): PrismaClient['role'] {
    return this.baseClient.role;
  }

  get permission(): PrismaClient['permission'] {
    return this.baseClient.permission;
  }

  get rolePermission(): PrismaClient['rolePermission'] {
    return this.baseClient.rolePermission;
  }

  get refreshToken(): PrismaClient['refreshToken'] {
    return this.baseClient.refreshToken;
  }

  get verificationToken(): PrismaClient['verificationToken'] {
    return this.baseClient.verificationToken;
  }

  /**
   * Enterprise Identity (v2.2) models — unscoped, like role/permission
   * above: IdentityProvider is org-scoped in the domain sense, but that
   * scoping isn't one the tenant extension enforces (it only wraps
   * organization/user/membership), so every repository method querying
   * these must filter by organizationId explicitly.
   */
  get identityProvider(): PrismaClient['identityProvider'] {
    return this.baseClient.identityProvider;
  }

  get samlConfiguration(): PrismaClient['samlConfiguration'] {
    return this.baseClient.samlConfiguration;
  }

  get oidcConfiguration(): PrismaClient['oidcConfiguration'] {
    return this.baseClient.oidcConfiguration;
  }

  /** SCIM 2.0 (v2.2 Phase 2) models — unscoped, same rationale as identityProvider above. */
  get scimToken(): PrismaClient['scimToken'] {
    return this.baseClient.scimToken;
  }

  get scimProvisionJob(): PrismaClient['scimProvisionJob'] {
    return this.baseClient.scimProvisionJob;
  }

  /**
   * Enterprise Organization Hierarchy (v2.2 Phase 3) models — unscoped,
   * same rationale as identityProvider above. `organization` itself stays
   * tenant-scoped (see the `organization` getter earlier in this file) —
   * `Organization.parentOrganizationId` is metadata read only by the
   * platform-admin-gated reporting endpoints, never by normal traffic.
   */
  get businessUnit(): PrismaClient['businessUnit'] {
    return this.baseClient.businessUnit;
  }

  get department(): PrismaClient['department'] {
    return this.baseClient.department;
  }

  get team(): PrismaClient['team'] {
    return this.baseClient.team;
  }

  get costCenter(): PrismaClient['costCenter'] {
    return this.baseClient.costCenter;
  }

  /**
   * Compliance Center (v2.2 Phase 5) models — unscoped, same reasoning as
   * identityProvider/samlConfiguration/oidcConfiguration above: these are
   * org-scoped in the domain sense, but that isn't a scope the tenant
   * extension enforces, so every repository method querying these must
   * filter by organizationId explicitly.
   */
  get auditExport(): PrismaClient['auditExport'] {
    return this.baseClient.auditExport;
  }

  get legalHold(): PrismaClient['legalHold'] {
    return this.baseClient.legalHold;
  }

  get retentionPolicy(): PrismaClient['retentionPolicy'] {
    return this.baseClient.retentionPolicy;
  }

  get consentRecord(): PrismaClient['consentRecord'] {
    return this.baseClient.consentRecord;
  }

  /**
   * v2.2 Security Center models — same convention as identityProvider above:
   * org/user-scoped in the domain sense, but not scoped by the tenant
   * extension, so every repository method filters by organizationId/userId
   * explicitly.
   */
  get session(): PrismaClient['session'] {
    return this.baseClient.session;
  }

  get trustedDevice(): PrismaClient['trustedDevice'] {
    return this.baseClient.trustedDevice;
  }

  get apiKey(): PrismaClient['apiKey'] {
    return this.baseClient.apiKey;
  }

  /** White-label (v2.2 Phase 6) models — unscoped, same rationale as identityProvider above. */
  get brandTheme(): PrismaClient['brandTheme'] {
    return this.baseClient.brandTheme;
  }

  get customDomain(): PrismaClient['customDomain'] {
    return this.baseClient.customDomain;
  }

  /** Platform Console (v2.2 Phase 7) models — unscoped, same rationale as identityProvider above. */
  get platformAlert(): PrismaClient['platformAlert'] {
    return this.baseClient.platformAlert;
  }

  get featureFlag(): PrismaClient['featureFlag'] {
    return this.baseClient.featureFlag;
  }

  $transaction<T>(fn: (tx: PrismaTransactionClient) => Promise<T>): Promise<T> {
    return this.runInTransaction(fn);
  }

  runInTransaction<T>(fn: (tx: PrismaTransactionClient) => Promise<T>): Promise<T> {
    return this.baseClient.$transaction(fn, this.transactionOptions);
  }

  runInSystemTransaction<T>(fn: (tx: PrismaTransactionClient) => Promise<T>): Promise<T> {
    return this.baseClient.$transaction(fn, this.transactionOptions);
  }

  async onModuleInit(): Promise<void> {
    await this.baseClient.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.baseClient.$disconnect();
  }
}

export function buildDatabaseConnectionUrl(
  databaseUrl: string,
  connectionLimit: number,
  poolTimeoutSeconds: number,
): string {
  const url = new URL(databaseUrl);

  if (!url.searchParams.has('connection_limit')) {
    url.searchParams.set('connection_limit', connectionLimit.toString());
  }

  if (!url.searchParams.has('pool_timeout')) {
    url.searchParams.set('pool_timeout', poolTimeoutSeconds.toString());
  }

  return url.toString();
}
