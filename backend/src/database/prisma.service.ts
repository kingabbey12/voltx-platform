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
