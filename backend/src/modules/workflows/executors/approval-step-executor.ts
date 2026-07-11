import { Injectable, Logger } from '@nestjs/common';
import { AuthContextRepository } from '../../auth/auth-context.repository';
import { NotificationService } from '../../notifications/notification.service';
import { WorkflowApprovalRepository } from '../workflow-approval.repository';
import { WorkflowApprovalEntity } from '../entities/workflow-support.entity';
import { ApprovalStepDefinition } from '../definition/workflow-definition.types';
import { StepExecutionContext, StepExecutionResult, StepExecutor } from './step-executor.interface';

/**
 * A human-in-the-loop gate. Unlike every other step type, this one does
 * not resolve synchronously: the first time a run reaches this step it
 * creates a WorkflowApproval row and returns `waiting: true`, which tells
 * the engine to stop advancing the run (WAITING_APPROVAL) rather than
 * treat the step as complete. Every subsequent time the engine re-enters
 * this step (after a resume triggered by an approval decision), it finds
 * the existing approval and either returns its outcome as output
 * (APPROVED) or throws (REJECTED/EXPIRED) so the step fails through the
 * normal retry/dead-letter path like anything else.
 */
@Injectable()
export class ApprovalStepExecutor implements StepExecutor {
  readonly type = 'APPROVAL' as const;
  private readonly logger = new Logger(ApprovalStepExecutor.name);

  constructor(
    private readonly workflowApprovalRepository: WorkflowApprovalRepository,
    private readonly authContextRepository: AuthContextRepository,
    private readonly notificationService: NotificationService,
  ) {}

  async execute(
    step: ApprovalStepDefinition,
    context: StepExecutionContext,
  ): Promise<StepExecutionResult> {
    const existing = await this.workflowApprovalRepository.findByStepRun(context.stepRunId);

    if (!existing) {
      const expiresAt = step.config.timeoutMs
        ? new Date(Date.now() + step.config.timeoutMs)
        : undefined;

      const created = await this.workflowApprovalRepository.create({
        workflowRunId: context.workflowRunId,
        stepRunId: context.stepRunId,
        approverRole: step.config.approverRole,
        expiresAt,
      });

      await this.notifyApprovers(context.organizationId, step, created);

      return { output: {}, waiting: true };
    }

    switch (existing.status) {
      case 'PENDING':
        return { output: {}, waiting: true };
      case 'REJECTED':
        throw new Error(
          `Approval step "${step.id}" was rejected${existing.comment ? `: ${existing.comment}` : ''}`,
        );
      case 'EXPIRED':
        throw new Error(`Approval step "${step.id}" expired waiting for a decision`);
      case 'APPROVED':
        return {
          output: {
            approved: true,
            approverUserId: existing.approverUserId,
            comment: existing.comment,
          },
        };
    }
  }

  /**
   * Parity fix with AgentActionApproval.notifyApprovers (ai/approvals) —
   * that system already notifies on creation, this one didn't. Best-
   * effort: a notification failure must never block the run from
   * correctly entering WAITING_APPROVAL.
   */
  private async notifyApprovers(
    organizationId: string,
    step: ApprovalStepDefinition,
    approval: WorkflowApprovalEntity,
  ): Promise<void> {
    try {
      const recipientUserIds = await this.authContextRepository.listActiveUserIdsWithPermission(
        organizationId,
        'workflow.approve',
      );

      await Promise.all(
        recipientUserIds.map((userId) =>
          this.notificationService.create({
            organizationId,
            userId,
            category: 'WORKFLOW',
            title: 'Workflow approval needed',
            body: step.config.message,
            actionUrl: `/workflows/runs/${approval.workflowRunId}`,
            metadata: { approvalId: approval.id, stepRunId: approval.stepRunId },
          }),
        ),
      );
    } catch (error) {
      this.logger.warn({ err: error }, 'Failed to notify workflow approvers');
    }
  }
}
