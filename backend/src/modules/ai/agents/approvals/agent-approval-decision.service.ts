import { Injectable, Logger } from '@nestjs/common';
import { NotificationService } from '../../../notifications/notification.service';
import { AgentApprovalService } from '../../approvals/agent-approval.service';
import { AgentActionApprovalEntity } from '../../approvals/entities/agent-action-approval.entity';
import { ConversationRepository } from '../../conversations/conversation.repository';
import { AgentRepository } from '../agent.repository';
import { AgentTaskQueueService } from '../jobs/agent-task-queue.service';

/**
 * Adds the "and then resume the paused run" orchestration on top of
 * AgentApprovalService's plain persistence — split out of AIModule since
 * resuming needs AgentRepository/MultiAgentOrchestratorService, which
 * live in AgentModule (which already depends on AIModule; the reverse
 * would be circular).
 */
@Injectable()
export class AgentApprovalDecisionService {
  private readonly logger = new Logger(AgentApprovalDecisionService.name);

  constructor(
    private readonly agentApprovalService: AgentApprovalService,
    private readonly agentTaskQueueService: AgentTaskQueueService,
    private readonly agentRepository: AgentRepository,
    private readonly conversationRepository: ConversationRepository,
    private readonly notificationService: NotificationService,
  ) {}

  async decide(
    approvalId: string,
    decision: 'APPROVED' | 'REJECTED',
    deciderId: string,
    comment?: string,
  ): Promise<AgentActionApprovalEntity> {
    const decided = await this.agentApprovalService.markDecided(
      approvalId,
      decision,
      deciderId,
      comment,
    );

    // The approver's request shouldn't wait for however long the resumed
    // continuation takes to run — background task execution (queued when
    // Redis is configured, direct fire-and-forget otherwise).
    this.agentTaskQueueService.enqueueResumeAfterApproval(
      decided.agentRunId,
      decided.id,
      decided.organizationId,
    );

    await this.notifyRunOwner(decided, decision);

    return decided;
  }

  /** Best-effort — never fails the decision over a notification-delivery problem. */
  private async notifyRunOwner(
    decided: AgentActionApprovalEntity,
    decision: 'APPROVED' | 'REJECTED',
  ): Promise<void> {
    try {
      const run = await this.agentRepository.findRunByIdUnscoped(decided.agentRunId);
      if (!run) return;

      const conversation = await this.conversationRepository.findConversationByIdUnscoped(
        run.conversationId,
      );
      if (!conversation) return;

      await this.notificationService.create({
        organizationId: decided.organizationId,
        userId: conversation.userId,
        category: 'AI',
        title:
          decision === 'APPROVED'
            ? `Approved: ${decided.toolName}`
            : `Rejected: ${decided.toolName}`,
        body:
          decision === 'APPROVED'
            ? 'Your agent run has been approved and is resuming.'
            : 'Your agent run request was rejected.',
        actionUrl: '/ai/operator',
        metadata: { approvalId: decided.id, agentRunId: decided.agentRunId },
      });
    } catch (error) {
      this.logger.warn(
        { err: error, approvalId: decided.id },
        'Failed to notify agent run owner of approval decision',
      );
    }
  }
}
