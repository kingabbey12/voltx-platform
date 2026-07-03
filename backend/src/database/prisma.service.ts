import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { TenantContextService } from '../common/tenant/tenant-context.service';
import { createTenantPrismaExtension } from './tenant-prisma.extension';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  private readonly baseClient = new PrismaClient();
  private readonly scopedClient: PrismaClient;

  constructor(tenantContextService: TenantContextService) {
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

  $transaction<T>(
    fn: (
      tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$extends'>,
    ) => Promise<T>,
  ): Promise<T> {
    return this.baseClient.$transaction(fn);
  }

  async onModuleInit(): Promise<void> {
    await this.baseClient.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.baseClient.$disconnect();
  }
}
