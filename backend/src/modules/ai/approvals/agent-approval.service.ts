import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { AuthContextRepository } from '../../auth/auth-context.repository';
import { NotificationService } from '../../notifications/notification.service';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import {
  AgentApprovalRepository,
  PaginatedAgentActionApprovals,
} from './agent-approval.repository';
import { describeToolCall } from './describe-tool-call';
import { ToolRegistry } from '../tools/tool.registry';
import { AgentActionApprovalEntity } from './entities/agent-action-approval.entity';

/**
 * Pure data + audit layer for AI tool-call approvals — deliberately does
 * NOT know how to actually resume a paused agent run (that orchestration
 * needs AgentService/AgentLoopService, which live in AgentModule; this
 * lives in AIModule so AiGatewayService.executeTool() — the single choke
 * point every tool call already goes through — can create a pending
 * approval directly, with no new circular module dependency). See
 * AgentApprovalDecisionService (AgentModule) for the resume trigger on
 * top of markDecided() below.
 */
@Injectable()
export class AgentApprovalService {
  constructor(
    private readonly approvalRepository: AgentApprovalRepository,
    private readonly auditService: AuditService,
    private readonly tenantContextService: TenantContextService,
    private readonly authContextRepository: AuthContextRepository,
    private readonly notificationService: NotificationService,
    private readonly toolRegistry: ToolRegistry,
  ) {}

  async findOrCreatePending(
    agentRunId: string,
    toolName: string,
    input: Record<string, unknown>,
  ): Promise<AgentActionApprovalEntity> {
    const existing = await this.approvalRepository.findPendingForRunAndTool(agentRunId, toolName);
    if (existing) {
      return existing;
    }

    const tenant = this.tenantContextService.getOrThrow();
    const created = await this.approvalRepository.createUnscoped(tenant.organizationId, {
      agentRunId,
      toolName,
      input,
      summary: this.summarize(toolName, input),
    });

    await this.auditService.record({
      action: 'ai.approval.requested',
      resource: 'agent_action_approval',
      resourceId: created.id,
      metadata: { agentRunId, toolName },
    });

    await this.notifyApprovers(tenant.organizationId, created);

    return created;
  }

  /**
   * The held-work sentence, written once at creation: the tool's own
   * describe() when it has one, else the generic backend describer. The
   * frontend renders the stored summary and never invents its own.
   */
  private summarize(toolName: string, input: Record<string, unknown>): string {
    try {
      const described = this.toolRegistry.get(toolName).describe?.(input);
      if (described && described.trim().length > 0) {
        return described.trim();
      }
    } catch {
      // Unknown/unregistered tool at approval time — fall through.
    }
    return describeToolCall(toolName, input);
  }

  /** Best-effort — a notification failure must never block the tool call from pausing correctly. */
  private async notifyApprovers(
    organizationId: string,
    approval: AgentActionApprovalEntity,
  ): Promise<void> {
    try {
      const recipientUserIds = await this.authContextRepository.listActiveUserIdsWithPermission(
        organizationId,
        'ai.approval.decide',
      );

      await Promise.all(
        recipientUserIds.map((userId) =>
          this.notificationService.create({
            organizationId,
            userId,
            category: 'AI',
            title: `Approval needed: ${approval.toolName}`,
            body: 'An AI agent is waiting for approval before it can continue.',
            actionUrl: '/ai/operator',
            metadata: { approvalId: approval.id, agentRunId: approval.agentRunId },
          }),
        ),
      );
    } catch {
      // Never fail approval creation over a notification-delivery problem.
    }
  }

  async getByIdOrThrow(id: string): Promise<AgentActionApprovalEntity> {
    const approval = await this.approvalRepository.findById(id);
    if (!approval) {
      throw new NotFoundException(`Approval "${id}" not found`);
    }
    return approval;
  }

  async getByIdOrThrowUnscoped(id: string): Promise<AgentActionApprovalEntity> {
    const approval = await this.approvalRepository.findByIdUnscoped(id);
    if (!approval) {
      throw new NotFoundException(`Approval "${id}" not found`);
    }
    return approval;
  }

  async listPending(page: number, limit: number): Promise<PaginatedAgentActionApprovals> {
    const tenant = this.tenantContextService.getOrThrow();
    return this.approvalRepository.findPendingByOrganization(tenant.organizationId, page, limit);
  }

  /**
   * Only one caller can ever win this: the pending→decided transition is
   * an atomic compare-and-swap in AgentApprovalRepository.decide()
   * (`UPDATE ... WHERE status = 'PENDING'`), so two concurrent decisions
   * on the same approval (double-click, two approvers) can never both
   * succeed. This existence check exists only to produce a proper 404 for
   * a genuinely-unknown id — the actual race is closed at the repository.
   */
  async markDecided(
    id: string,
    status: 'APPROVED' | 'REJECTED',
    approverUserId: string,
    comment?: string,
  ): Promise<AgentActionApprovalEntity> {
    await this.getByIdOrThrow(id);

    const decided = await this.approvalRepository.decide(id, {
      status,
      approverUserId,
      comment,
    });

    if (!decided) {
      throw new BadRequestException(`Approval "${id}" has already been decided`);
    }

    await this.auditService.record({
      action: status === 'APPROVED' ? 'ai.approval.approved' : 'ai.approval.rejected',
      resource: 'agent_action_approval',
      resourceId: id,
      metadata: { agentRunId: decided.agentRunId, toolName: decided.toolName, comment },
    });

    return decided;
  }
}
