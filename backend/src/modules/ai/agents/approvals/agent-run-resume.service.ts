import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { AuthContextRepository } from '../../../auth/auth-context.repository';
import { PermissionService } from '../../../permissions/permission.service';
import { TenantContextService } from '../../../../common/tenant/tenant-context.service';
import { AgentApprovalService } from '../../approvals/agent-approval.service';
import { AgentActionApprovalEntity } from '../../approvals/entities/agent-action-approval.entity';
import { AIGatewayService } from '../../gateway/ai-gateway.service';
import { ConversationRepository } from '../../conversations/conversation.repository';
import { drainToReturnValue } from '../../streaming/drain-generator';
import { AgentRepository } from '../agent.repository';
import { MultiAgentOrchestratorService } from '../autonomous/multi-agent-orchestrator.service';

/**
 * Continues a paused agent run once its pending approval has been
 * decided. Runs entirely outside any HTTP request's tenant context (an
 * approval decision may be enqueued and decided long after the original
 * requester's request ended), so it rebuilds a tenant context explicitly
 * from the run's owning conversation — same pattern
 * CommsAiProcessingService uses for the same reason.
 *
 * Rather than reconstructing the paused ReAct loop's in-memory state, a
 * resume simply starts a fresh continuation turn on the same
 * conversation/run: the conversation already holds the full prior
 * history, so the model re-reasons with complete context plus the real
 * outcome of the approved/rejected action — reusing
 * MultiAgentOrchestratorService.runAgent unchanged for finalization
 * (SUCCEEDED/FAILED/WAITING_APPROVAL-again all handled identically to any
 * other run).
 */
@Injectable()
export class AgentRunResumeService {
  private readonly logger = new Logger(AgentRunResumeService.name);

  constructor(
    private readonly agentApprovalService: AgentApprovalService,
    private readonly agentRepository: AgentRepository,
    private readonly conversationRepository: ConversationRepository,
    private readonly authContextRepository: AuthContextRepository,
    private readonly permissionService: PermissionService,
    private readonly tenantContextService: TenantContextService,
    private readonly aiGatewayService: AIGatewayService,
    private readonly multiAgentOrchestratorService: MultiAgentOrchestratorService,
  ) {}

  async resume(agentRunId: string, approvalId: string): Promise<void> {
    try {
      const agentRun = await this.agentRepository.findRunByIdUnscoped(agentRunId);
      if (!agentRun || agentRun.status !== 'WAITING_APPROVAL') {
        return;
      }

      const conversation = await this.conversationRepository.findConversationByIdUnscoped(
        agentRun.conversationId,
      );
      if (!conversation) {
        this.logger.warn({ agentRunId }, 'Cannot resume run: owning conversation not found');
        return;
      }

      const membership = await this.authContextRepository.findActiveMembershipContext(
        conversation.userId,
        conversation.organizationId,
      );
      if (!membership) {
        this.logger.warn(
          { agentRunId, organizationId: conversation.organizationId },
          'Cannot resume run: no active membership for the conversation owner',
        );
        return;
      }

      await this.tenantContextService.run(
        {
          organizationId: conversation.organizationId,
          userId: conversation.userId,
          membershipId: membership.id,
          requestId: randomUUID(),
        },
        () => this.resumeWithinTenantContext(agentRun.id, approvalId, membership.roleId),
      );
    } catch (error) {
      this.logger.error({ err: error, agentRunId, approvalId }, 'Failed to resume agent run');
    }
  }

  private async resumeWithinTenantContext(
    agentRunId: string,
    approvalId: string,
    roleId: string,
  ): Promise<void> {
    // Atomic claim FIRST, before any tool execution: this is what actually
    // prevents two concurrent resume attempts (e.g. a redelivered
    // background job) from both executing the approved tool call. Only the
    // caller that flips WAITING_APPROVAL -> RUNNING proceeds; the loser
    // returns immediately.
    const claimed = await this.agentRepository.claimRunForResume(agentRunId);
    if (!claimed) {
      this.logger.warn(
        { agentRunId, approvalId },
        'Skipping resume: run was already claimed by another resume attempt or is no longer waiting for approval',
      );
      return;
    }

    const approval = await this.agentApprovalService.getByIdOrThrowUnscoped(approvalId);
    const agentRun = await this.agentRepository.findRunById(agentRunId);
    if (!agentRun) return;

    const agent = await this.agentRepository.findAgentByIdUnscoped(agentRun.agentId);
    if (!agent) return;

    const grantedPermissions = await this.permissionService.getPermissionKeysForRole(roleId);
    const objective = this.buildContinuationObjective(agentRun, approval);
    const continuationObjective = await this.executeApprovedActionIfNeeded(
      agent.id,
      agentRun.id,
      agentRun.conversationId,
      approval,
      grantedPermissions,
      objective,
    );

    const coordinationState = this.multiAgentOrchestratorService.createCoordinationStateForRoot(
      agentRun.rootRunId ?? agentRun.id,
    );

    await drainToReturnValue(
      this.multiAgentOrchestratorService.runAgent(
        agent,
        { ...agentRun, status: 'RUNNING' },
        { objective: continuationObjective, workspaceContext: [] },
        coordinationState,
        grantedPermissions,
      ),
    ).catch((error: unknown) => {
      this.logger.error(
        { err: error, agentRunId },
        'Resumed agent run continuation failed after approval decision',
      );
    });
  }

  private buildContinuationObjective(
    agentRun: { input: Record<string, unknown> },
    approval: AgentActionApprovalEntity,
  ): string {
    const originalObjective =
      typeof agentRun.input.objective === 'string' ? agentRun.input.objective : '';
    return approval.status === 'APPROVED'
      ? `Your request to call the tool "${approval.toolName}" was approved by a human reviewer. The original objective was: "${originalObjective}".`
      : `Your request to call the tool "${approval.toolName}" was rejected by a human reviewer${
          approval.comment ? ` with the reason: "${approval.comment}"` : ''
        }. Do not attempt that action again. The original objective was: "${originalObjective}". Continue toward it using an alternative approach if possible, or explain to the user why you could not complete it.`;
  }

  /** For an approved action, actually runs the tool now (the gate never ran it) and folds the real result into the continuation objective so the model reasons over real data, not a description of the decision. */
  private async executeApprovedActionIfNeeded(
    agentId: string,
    agentRunId: string,
    conversationId: string,
    approval: AgentActionApprovalEntity,
    grantedPermissions: string[],
    baseObjective: string,
  ): Promise<string> {
    if (approval.status !== 'APPROVED') {
      return baseObjective;
    }

    try {
      const response = await this.aiGatewayService.executeTool(
        { conversationId, toolName: approval.toolName, input: approval.input },
        { agentId, agentRunId, grantedPermissions, skipApprovalCheck: true },
      );
      return `${baseObjective} The tool result was: ${response.result.content}`;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Tool execution failed';
      return `${baseObjective} Attempting the approved action failed with: ${message}. Explain this to the user and suggest next steps.`;
    }
  }
}
