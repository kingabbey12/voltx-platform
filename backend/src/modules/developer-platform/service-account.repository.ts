import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { MembershipStatus, ServiceAccountStatus, UserStatus, UserType } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  ServiceAccountEntity,
  ServiceAccountTokenEntity,
  toServiceAccountEntity,
  toServiceAccountTokenEntity,
} from './entities/service-account.entity';

export interface CreateServiceAccountData {
  organizationId: string;
  name: string;
  description?: string;
  roleId: string;
  createdByUserId: string;
}

export interface CreateServiceAccountTokenData {
  serviceAccountId: string;
  name: string;
  tokenHash: string;
  tokenPrefix: string;
  expiresAt?: Date;
}

@Injectable()
export class ServiceAccountRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates the synthetic User row, its real Membership (so RBAC works
   * unmodified), and the ServiceAccount row itself in one transaction —
   * a partial failure must never leave an orphaned synthetic user with
   * no owning ServiceAccount, or vice versa.
   */
  async create(data: CreateServiceAccountData): Promise<ServiceAccountEntity> {
    const syntheticEmail = `service-account+${randomUUID()}@service-accounts.voltx.internal`;

    const record = await this.prisma.runInTransaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: syntheticEmail,
          firstName: data.name,
          lastName: '(Service Account)',
          type: UserType.SERVICE_ACCOUNT,
          status: UserStatus.ACTIVE,
          emailVerifiedAt: new Date(),
        },
      });

      await tx.membership.create({
        data: {
          userId: user.id,
          organizationId: data.organizationId,
          roleId: data.roleId,
          status: MembershipStatus.ACTIVE,
        },
      });

      return tx.serviceAccount.create({
        data: {
          organizationId: data.organizationId,
          userId: user.id,
          name: data.name,
          description: data.description,
          createdByUserId: data.createdByUserId,
        },
      });
    });

    return toServiceAccountEntity(record);
  }

  async listByOrganization(organizationId: string): Promise<ServiceAccountEntity[]> {
    const records = await this.prisma.system.serviceAccount.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
    return records.map(toServiceAccountEntity);
  }

  async findByIdInOrganization(
    id: string,
    organizationId: string,
  ): Promise<ServiceAccountEntity | null> {
    const record = await this.prisma.system.serviceAccount.findFirst({
      where: { id, organizationId },
    });
    return record ? toServiceAccountEntity(record) : null;
  }

  /** Unscoped — used only by ServiceAccountGuard, resolving the account behind an already-verified token. */
  async findByIdUnscoped(id: string): Promise<ServiceAccountEntity | null> {
    const record = await this.prisma.system.serviceAccount.findUnique({ where: { id } });
    return record ? toServiceAccountEntity(record) : null;
  }

  async setStatus(id: string, status: ServiceAccountStatus): Promise<ServiceAccountEntity> {
    const record = await this.prisma.system.serviceAccount.update({
      where: { id },
      data: { status },
    });
    return toServiceAccountEntity(record);
  }

  async createToken(data: CreateServiceAccountTokenData): Promise<ServiceAccountTokenEntity> {
    const record = await this.prisma.system.serviceAccountToken.create({ data });
    return toServiceAccountTokenEntity(record);
  }

  async listTokens(serviceAccountId: string): Promise<ServiceAccountTokenEntity[]> {
    const records = await this.prisma.system.serviceAccountToken.findMany({
      where: { serviceAccountId },
      orderBy: { createdAt: 'desc' },
    });
    return records.map(toServiceAccountTokenEntity);
  }

  async findTokenByIdForAccount(
    id: string,
    serviceAccountId: string,
  ): Promise<ServiceAccountTokenEntity | null> {
    const record = await this.prisma.system.serviceAccountToken.findFirst({
      where: { id, serviceAccountId },
    });
    return record ? toServiceAccountTokenEntity(record) : null;
  }

  /** Unscoped — used only by ServiceAccountGuard. */
  async findActiveTokenByHash(tokenHash: string): Promise<ServiceAccountTokenEntity | null> {
    const record = await this.prisma.system.serviceAccountToken.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
    return record ? toServiceAccountTokenEntity(record) : null;
  }

  async touchTokenLastUsedAt(id: string): Promise<void> {
    await this.prisma.system.serviceAccountToken.updateMany({
      where: { id, revokedAt: null },
      data: { lastUsedAt: new Date() },
    });
  }

  async revokeToken(id: string): Promise<void> {
    await this.prisma.system.serviceAccountToken.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
  }
}
