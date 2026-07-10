import { Injectable } from '@nestjs/common';
import { AgentApprovalService } from '../../approvals/agent-approval.service';
import { AgentActionApprovalEntity } from '../../approvals/entities/agent-action-approval.entity';
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
  constructor(
    private readonly agentApprovalService: AgentApprovalService,
    private readonly agentTaskQueueService: AgentTaskQueueService,
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
    this.agentTaskQueueService.enqueueResumeAfterApproval(decided.agentRunId, decided.id);

    return decided;
  }
}
