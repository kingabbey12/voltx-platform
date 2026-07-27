import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { AIProviderName } from '../models/ai-model.types';
import {
  AiProviderCredentialEntity,
  AiProviderCredentialStatus,
  toAiProviderCredentialEntity,
} from './entities/ai-provider-credential.entity';

export interface CreateCredentialData {
  provider: AIProviderName;
  label: string;
  encryptedApiKey: string;
  baseUrl: string | null;
  metadata: Record<string, unknown>;
  createdByUserId: string | null;
}

export interface UpdateCredentialData {
  label?: string;
  baseUrl?: string | null;
  status?: AiProviderCredentialStatus;
  metadata?: Record<string, unknown>;
  encryptedApiKey?: string;
  lastRotatedAt?: Date;
  lastTestedAt?: Date;
  lastTestStatus?: string | null;
  lastTestError?: string | null;
}

export interface ListCredentialsParams {
  provider?: AIProviderName;
  page: number;
  limit: number;
}

export interface PaginatedCredentials {
  items: AiProviderCredentialEntity[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Tenant-scoped persistence for AI provider credentials. Every query is
 * filtered by the current organizationId (defense-in-depth alongside the
 * platform's row-level isolation), so a credential from another tenant is
 * never visible, mutable, or deletable here.
 */
@Injectable()
export class TenantAiCredentialsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  private get delegate() {
    return this.prisma.system.aiProviderCredential;
  }

  async create(data: CreateCredentialData): Promise<AiProviderCredentialEntity> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.delegate.create({
      data: {
        organizationId: tenant.organizationId,
        provider: data.provider,
        label: data.label,
        encryptedApiKey: data.encryptedApiKey,
        baseUrl: data.baseUrl,
        metadata: data.metadata as Prisma.InputJsonValue,
        createdByUserId: data.createdByUserId,
      },
    });
    return toAiProviderCredentialEntity(record);
  }

  async findById(id: string): Promise<AiProviderCredentialEntity | null> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.delegate.findFirst({
      where: { id, organizationId: tenant.organizationId, deletedAt: null },
    });
    return record ? toAiProviderCredentialEntity(record) : null;
  }

  /** The single ACTIVE credential for a provider — what the gateway resolves. */
  async findActiveForProvider(
    organizationId: string,
    provider: AIProviderName,
  ): Promise<AiProviderCredentialEntity | null> {
    const record = await this.delegate.findFirst({
      where: { organizationId, provider, status: 'ACTIVE', deletedAt: null },
      orderBy: { updatedAt: 'desc' },
    });
    return record ? toAiProviderCredentialEntity(record) : null;
  }

  async existsForProviderLabel(provider: AIProviderName, label: string): Promise<boolean> {
    const tenant = this.tenantContextService.getOrThrow();
    const count = await this.delegate.count({
      where: { organizationId: tenant.organizationId, provider, label, deletedAt: null },
    });
    return count > 0;
  }

  async list(params: ListCredentialsParams): Promise<PaginatedCredentials> {
    const tenant = this.tenantContextService.getOrThrow();
    const where: Prisma.AiProviderCredentialWhereInput = {
      organizationId: tenant.organizationId,
      deletedAt: null,
      ...(params.provider ? { provider: params.provider } : {}),
    };
    const [records, total] = await Promise.all([
      this.delegate.findMany({
        where,
        orderBy: [{ provider: 'asc' }, { label: 'asc' }],
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      this.delegate.count({ where }),
    ]);
    return {
      items: records.map(toAiProviderCredentialEntity),
      total,
      page: params.page,
      limit: params.limit,
    };
  }

  async listAllActive(organizationId: string): Promise<AiProviderCredentialEntity[]> {
    const records = await this.delegate.findMany({
      where: { organizationId, deletedAt: null },
      orderBy: [{ provider: 'asc' }, { label: 'asc' }],
    });
    return records.map(toAiProviderCredentialEntity);
  }

  async update(id: string, data: UpdateCredentialData): Promise<AiProviderCredentialEntity | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }
    const record = await this.delegate.update({
      where: { id },
      data: {
        ...(data.label !== undefined ? { label: data.label } : {}),
        ...(data.baseUrl !== undefined ? { baseUrl: data.baseUrl } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.metadata !== undefined
          ? { metadata: data.metadata as Prisma.InputJsonValue }
          : {}),
        ...(data.encryptedApiKey !== undefined ? { encryptedApiKey: data.encryptedApiKey } : {}),
        ...(data.lastRotatedAt !== undefined ? { lastRotatedAt: data.lastRotatedAt } : {}),
        ...(data.lastTestedAt !== undefined ? { lastTestedAt: data.lastTestedAt } : {}),
        ...(data.lastTestStatus !== undefined ? { lastTestStatus: data.lastTestStatus } : {}),
        ...(data.lastTestError !== undefined ? { lastTestError: data.lastTestError } : {}),
      },
    });
    return toAiProviderCredentialEntity(record);
  }

  async softDelete(id: string): Promise<AiProviderCredentialEntity | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }
    const record = await this.delegate.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'DISABLED' },
    });
    return toAiProviderCredentialEntity(record);
  }
}
