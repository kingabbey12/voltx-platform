import { Injectable } from '@nestjs/common';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';
import { WorkflowWebhookEntity } from './entities/workflow-webhook.entity';

export interface CreateWorkflowWebhookData {
  workflowId: string;
  token: string;
  encryptedSecret: string;
}

interface WorkflowWebhookRecord extends WorkflowWebhookEntity {
  encryptedSecret: string;
}

interface WorkflowWebhookClient {
  create(args: { data: Record<string, unknown> }): Promise<WorkflowWebhookRecord>;
  findFirst(args: { where: Record<string, unknown> }): Promise<WorkflowWebhookRecord | null>;
  findMany(args: { where: Record<string, unknown> }): Promise<WorkflowWebhookRecord[]>;
  update(args: {
    where: { id: string };
    data: Record<string, unknown>;
  }): Promise<WorkflowWebhookRecord>;
  delete(args: { where: { id: string } }): Promise<WorkflowWebhookRecord>;
}

/**
 * Mirrors IntegrationWebhookEndpointRepository's pattern exactly: `token`
 * is the unguessable path segment, `encryptedSecret` verifies the
 * caller's HMAC signature. findByTokenUnscoped is unscoped by design —
 * an inbound webhook request arrives with no tenant context, the token
 * itself is what resolves it (same reasoning as the Integrations sibling).
 */
@Injectable()
export class WorkflowWebhookRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async create(data: CreateWorkflowWebhookData): Promise<WorkflowWebhookRecord> {
    const tenant = this.tenantContextService.getOrThrow();
    return this.client().create({
      data: {
        organizationId: tenant.organizationId,
        workflowId: data.workflowId,
        token: data.token,
        encryptedSecret: data.encryptedSecret,
      },
    });
  }

  async findById(id: string): Promise<WorkflowWebhookRecord | null> {
    const tenant = this.tenantContextService.getOrThrow();
    return this.client().findFirst({ where: { id, organizationId: tenant.organizationId } });
  }

  async findByTokenUnscoped(token: string): Promise<WorkflowWebhookRecord | null> {
    return this.client().findFirst({ where: { token } });
  }

  async listForWorkflow(workflowId: string): Promise<WorkflowWebhookEntity[]> {
    const tenant = this.tenantContextService.getOrThrow();
    const records = await this.client().findMany({
      where: { workflowId, organizationId: tenant.organizationId },
    });
    return records.map(({ encryptedSecret: _encryptedSecret, ...rest }) => rest);
  }

  async setEnabled(id: string, enabled: boolean): Promise<WorkflowWebhookRecord | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }
    return this.client().update({ where: { id }, data: { enabled } });
  }

  async markTriggered(id: string): Promise<void> {
    await this.client().update({ where: { id }, data: { lastTriggeredAt: new Date() } });
  }

  async remove(id: string): Promise<WorkflowWebhookRecord | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }
    return this.client().delete({ where: { id } });
  }

  private client(): WorkflowWebhookClient {
    return (this.prisma.system as unknown as { workflowWebhook: WorkflowWebhookClient })
      .workflowWebhook;
  }
}
