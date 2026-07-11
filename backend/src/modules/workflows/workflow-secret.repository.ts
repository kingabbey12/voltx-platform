import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';
import { WorkflowSecretEntity } from './entities/workflow-secret.entity';

export interface CreateWorkflowSecretData {
  key: string;
  encryptedValue: string;
  description?: string;
  createdBy: string;
}

interface WorkflowSecretRecord extends WorkflowSecretEntity {
  encryptedValue: string;
}

interface WorkflowSecretClient {
  create(args: { data: Record<string, unknown> }): Promise<WorkflowSecretRecord>;
  findFirst(args: { where: Record<string, unknown> }): Promise<WorkflowSecretRecord | null>;
  findMany(args: {
    where: Record<string, unknown>;
    orderBy?: Array<Record<string, 'asc' | 'desc'>>;
  }): Promise<WorkflowSecretRecord[]>;
  update(args: {
    where: { id: string };
    data: Record<string, unknown>;
  }): Promise<WorkflowSecretRecord>;
  delete(args: { where: { id: string } }): Promise<WorkflowSecretRecord>;
}

/**
 * Values are always encrypted at rest via EncryptionService (the service
 * layer's job, not this repository's) — this layer stores/retrieves the
 * opaque `encryptedValue` string exactly like IntegrationCredentialRepository
 * does for OAuth tokens.
 */
@Injectable()
export class WorkflowSecretRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async create(data: CreateWorkflowSecretData): Promise<WorkflowSecretRecord> {
    const tenant = this.tenantContextService.getOrThrow();
    return this.client().create({
      data: {
        organizationId: tenant.organizationId,
        key: data.key,
        encryptedValue: data.encryptedValue,
        description: data.description ?? null,
        createdBy: data.createdBy,
      },
    });
  }

  async findById(id: string): Promise<WorkflowSecretRecord | null> {
    const tenant = this.tenantContextService.getOrThrow();
    return this.client().findFirst({ where: { id, organizationId: tenant.organizationId } });
  }

  async findByKey(key: string): Promise<WorkflowSecretRecord | null> {
    const tenant = this.tenantContextService.getOrThrow();
    return this.client().findFirst({ where: { key, organizationId: tenant.organizationId } });
  }

  async listAll(): Promise<WorkflowSecretEntity[]> {
    const tenant = this.tenantContextService.getOrThrow();
    const records = await this.client().findMany({
      where: { organizationId: tenant.organizationId },
      orderBy: [{ key: 'asc' }],
    });
    return records.map(({ encryptedValue: _encryptedValue, ...rest }) => rest);
  }

  async rotate(id: string, encryptedValue: string): Promise<WorkflowSecretRecord | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }
    return this.client().update({
      where: { id },
      data: { encryptedValue, lastRotatedAt: new Date() },
    });
  }

  async markUsed(id: string): Promise<void> {
    await this.client().update({ where: { id }, data: { lastUsedAt: new Date() } });
  }

  async remove(id: string): Promise<WorkflowSecretRecord | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }
    return this.client().delete({ where: { id } });
  }

  private client(): WorkflowSecretClient {
    return (this.prisma.system as unknown as { workflowSecret: WorkflowSecretClient })
      .workflowSecret;
  }
}
