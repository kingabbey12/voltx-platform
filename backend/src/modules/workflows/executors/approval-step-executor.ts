import { Injectable } from '@nestjs/common';
import { WorkflowApprovalRepository } from '../workflow-approval.repository';
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

  constructor(private readonly workflowApprovalRepository: WorkflowApprovalRepository) {}

  async execute(
    step: ApprovalStepDefinition,
    context: StepExecutionContext,
  ): Promise<StepExecutionResult> {
    const existing = await this.workflowApprovalRepository.findByStepRun(context.stepRunId);

    if (!existing) {
      const expiresAt = step.config.timeoutMs
        ? new Date(Date.now() + step.config.timeoutMs)
        : undefined;

      await this.workflowApprovalRepository.create({
        workflowRunId: context.workflowRunId,
        stepRunId: context.stepRunId,
        approverRole: step.config.approverRole,
        expiresAt,
      });

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
}
