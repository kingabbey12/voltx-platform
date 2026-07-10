import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import {
  AgentApprovalRepository,
  PaginatedAgentActionApprovals,
} from './agent-approval.repository';
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
    });

    await this.auditService.record({
      action: 'ai.approval.requested',
      resource: 'agent_action_approval',
      resourceId: created.id,
      metadata: { agentRunId, toolName },
    });

    return created;
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

  async markDecided(
    id: string,
    status: 'APPROVED' | 'REJECTED',
    approverUserId: string,
    comment?: string,
  ): Promise<AgentActionApprovalEntity> {
    const approval = await this.getByIdOrThrow(id);
    if (approval.status !== 'PENDING') {
      throw new BadRequestException(`Approval "${id}" has already been decided`);
    }

    const decided = await this.approvalRepository.decide(id, {
      status,
      approverUserId,
      comment,
    });

    await this.auditService.record({
      action: status === 'APPROVED' ? 'ai.approval.approved' : 'ai.approval.rejected',
      resource: 'agent_action_approval',
      resourceId: id,
      metadata: { agentRunId: approval.agentRunId, toolName: approval.toolName, comment },
    });

    return decided;
  }
}
