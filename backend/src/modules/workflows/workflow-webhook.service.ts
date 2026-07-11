import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { AuthContextRepository } from '../auth/auth-context.repository';
import { EncryptionService } from '../integrations/security/encryption.service';
import { WorkflowRepository } from './workflow.repository';
import { WorkflowWebhookEntity } from './entities/workflow-webhook.entity';
import { WorkflowWebhookRepository } from './workflow-webhook.repository';
import { WorkflowService } from './workflow.service';

export interface WorkflowWebhookCreationResult {
  webhook: WorkflowWebhookEntity;
  /** Returned exactly once, at creation time — never persisted or retrievable again. */
  secret: string;
}

/**
 * Manages inbound webhooks that start a workflow run — same shape as
 * IntegrationWebhookEndpoint/IntegrationWebhookReceiverService (token as
 * the unguessable path segment, HMAC-signed body, encrypted secret at
 * rest), adapted to sign with a scheme Voltx itself defines (this isn't a
 * third-party provider's fixed signature format) rather than reusing
 * IntegrationProvider.verifyWebhookSignature, which is provider-specific.
 */
@Injectable()
export class WorkflowWebhookService {
  private readonly logger = new Logger(WorkflowWebhookService.name);

  constructor(
    private readonly workflowWebhookRepository: WorkflowWebhookRepository,
    private readonly workflowRepository: WorkflowRepository,
    private readonly workflowService: WorkflowService,
    private readonly encryptionService: EncryptionService,
    private readonly authContextRepository: AuthContextRepository,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async create(workflowId: string): Promise<WorkflowWebhookCreationResult> {
    const workflow = await this.workflowRepository.findById(workflowId);
    if (!workflow) {
      throw new NotFoundException('Workflow not found');
    }

    const token = randomUUID();
    const secret = randomBytes(24).toString('hex');
    const webhook = await this.workflowWebhookRepository.create({
      workflowId,
      token,
      encryptedSecret: this.encryptionService.encrypt(secret),
    });

    return { webhook: toPublicEntity(webhook), secret };
  }

  async list(workflowId: string): Promise<WorkflowWebhookEntity[]> {
    return this.workflowWebhookRepository.listForWorkflow(workflowId);
  }

  async setEnabled(id: string, enabled: boolean): Promise<WorkflowWebhookEntity> {
    const updated = await this.workflowWebhookRepository.setEnabled(id, enabled);
    if (!updated) {
      throw new NotFoundException('Workflow webhook not found');
    }
    return toPublicEntity(updated);
  }

  async remove(id: string): Promise<WorkflowWebhookEntity> {
    const removed = await this.workflowWebhookRepository.remove(id);
    if (!removed) {
      throw new NotFoundException('Workflow webhook not found');
    }
    return toPublicEntity(removed);
  }

  /**
   * Public receiver — no bearer token (the caller is external), tenant
   * scoping comes from the token resolving to exactly one workflow/org,
   * and the HMAC signature is what proves the request is authorized.
   */
  async receive(
    token: string,
    signatureHeader: string | undefined,
    rawBody: string,
  ): Promise<{ received: boolean; runId: string }> {
    const webhook = await this.workflowWebhookRepository.findByTokenUnscoped(token);
    if (!webhook || !webhook.enabled) {
      throw new NotFoundException('Webhook not found');
    }

    const secret = this.encryptionService.decrypt(webhook.encryptedSecret);
    if (!verifySignature(secret, rawBody, signatureHeader)) {
      throw new NotFoundException('Webhook not found');
    }

    const workflow = await this.workflowRepository.findByIdUnscoped(webhook.workflowId);
    if (!workflow || workflow.status !== 'PUBLISHED') {
      throw new NotFoundException('Webhook not found');
    }

    const membership = await this.authContextRepository.findActiveMembershipContext(
      workflow.createdBy,
      workflow.organizationId,
    );
    if (!membership) {
      throw new NotFoundException('Webhook not found');
    }

    let input: Record<string, unknown> = {};
    try {
      input = rawBody ? (JSON.parse(rawBody) as Record<string, unknown>) : {};
    } catch {
      // Non-JSON bodies are passed through as an empty input rather than rejected.
    }

    const runId = await this.tenantContextService.run(
      {
        organizationId: workflow.organizationId,
        userId: workflow.createdBy,
        membershipId: membership.id,
        requestId: randomUUID(),
      },
      async () => {
        const run = await this.workflowService.runWorkflow(workflow.id, {
          input,
          triggerType: 'API',
        });
        return run.id;
      },
    );

    await this.workflowWebhookRepository.markTriggered(webhook.id);
    this.logger.log({ workflowId: workflow.id, runId }, 'Started a run from an inbound webhook');

    return { received: true, runId };
  }
}

function verifySignature(secret: string, rawBody: string, signatureHeader?: string): boolean {
  if (!signatureHeader) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  const provided = signatureHeader.replace(/^sha256=/, '');
  const expectedBuffer = Buffer.from(expected, 'hex');
  const providedBuffer = Buffer.from(provided, 'hex');
  if (expectedBuffer.length !== providedBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, providedBuffer);
}

function toPublicEntity(
  record: WorkflowWebhookEntity & { encryptedSecret?: string },
): WorkflowWebhookEntity {
  const { encryptedSecret: _encryptedSecret, ...rest } = record;
  return rest;
}
