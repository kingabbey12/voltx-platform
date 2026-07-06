import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service';
import { AIProviderName } from '../ai/models/ai-model.types';
import { ConversationResponseDto } from '../ai/conversations/dto/conversation.dto';
import { ConversationService } from '../ai/conversations/conversation.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { drainToReturnValue } from '../ai/streaming/drain-generator';
import { WorkflowDefinition } from './definition/workflow-definition.types';
import { WorkflowDefinitionValidatorService } from './definition/workflow-definition-validator.service';
import { WorkflowEngineService } from './engine/workflow-engine.service';
import { WorkflowStreamEvent } from './engine/workflow-stream-event.types';
import { WorkflowApprovalEntity, WorkflowApprovalStatus } from './entities/workflow-support.entity';
import { WorkflowEntity } from './entities/workflow.entity';
import { WorkflowRunEntity, WorkflowTriggerType } from './entities/workflow-run.entity';
import { WorkflowVersionEntity } from './entities/workflow-version.entity';
import { WorkflowApprovalRepository } from './workflow-approval.repository';
import { WorkflowCheckpointRepository } from './workflow-checkpoint.repository';
import { WorkflowDeadLetterRepository } from './workflow-dead-letter.repository';
import { WorkflowLogRepository } from './workflow-log.repository';
import {
  FindWorkflowRunsParams,
  PaginatedWorkflowRuns,
  WorkflowRunRepository,
} from './workflow-run.repository';
import { WorkflowStepRunRepository } from './workflow-step-run.repository';
import { FindWorkflowsParams, PaginatedWorkflows, WorkflowRepository } from './workflow.repository';
import { WorkflowVersionRepository } from './workflow-version.repository';

export interface CreateWorkflowRequest {
  name: string;
  description?: string;
  definition: WorkflowDefinition;
}

export interface UpdateWorkflowRequest {
  name?: string;
  description?: string;
  definition?: WorkflowDefinition;
}

export interface RunWorkflowRequest {
  input?: Record<string, unknown>;
  idempotencyKey?: string;
  triggerType?: WorkflowTriggerType;
  triggeredBy?: string;
}

/**
 * Admin-facing orchestration layer: workflow CRUD/publish/archive/version
 * management, and the create-run -> drive-engine glue for every trigger
 * path (the HTTP run/resume/retry endpoints in this module's controller,
 * and WorkflowSchedulerService for CRON/DELAYED/EVENT triggers). The
 * actual DAG execution lives entirely in WorkflowEngineService — this
 * class never touches step scheduling itself.
 */
@Injectable()
export class WorkflowService {
  constructor(
    private readonly workflowRepository: WorkflowRepository,
    private readonly workflowVersionRepository: WorkflowVersionRepository,
    private readonly workflowRunRepository: WorkflowRunRepository,
    private readonly workflowStepRunRepository: WorkflowStepRunRepository,
    private readonly workflowLogRepository: WorkflowLogRepository,
    private readonly workflowCheckpointRepository: WorkflowCheckpointRepository,
    private readonly workflowDeadLetterRepository: WorkflowDeadLetterRepository,
    private readonly workflowApprovalRepository: WorkflowApprovalRepository,
    private readonly workflowDefinitionValidatorService: WorkflowDefinitionValidatorService,
    private readonly workflowEngineService: WorkflowEngineService,
    private readonly conversationService: ConversationService,
    private readonly auditService: AuditService,
    private readonly tenantContextService: TenantContextService,
    private readonly configService: ConfigService,
  ) {}

  async createWorkflow(request: CreateWorkflowRequest): Promise<WorkflowEntity> {
    this.workflowDefinitionValidatorService.validate(request.definition);

    const tenant = this.tenantContextService.getOrThrow();
    const existing = await this.workflowRepository.findByName(request.name);
    if (existing) {
      throw new ConflictException(`Workflow with name "${request.name}" already exists`);
    }

    const workflow = await this.workflowRepository.create({
      name: request.name,
      description: request.description,
      createdBy: tenant.userId,
    });
    await this.workflowVersionRepository.create({
      workflowId: workflow.id,
      version: 1,
      definition: request.definition,
      createdBy: tenant.userId,
    });

    await this.auditService.record({
      action: 'create',
      resource: 'workflow',
      resourceId: workflow.id,
      metadata: { name: workflow.name },
    });

    return workflow;
  }

  async getWorkflowOrThrow(id: string): Promise<WorkflowEntity> {
    const workflow = await this.workflowRepository.findById(id);
    if (!workflow) {
      throw new NotFoundException(`Workflow with id "${id}" not found`);
    }
    return workflow;
  }

  async listWorkflows(params: FindWorkflowsParams): Promise<PaginatedWorkflows> {
    return this.workflowRepository.findAll(params);
  }

  async updateWorkflow(id: string, request: UpdateWorkflowRequest): Promise<WorkflowEntity> {
    await this.getWorkflowOrThrow(id);
    const tenant = this.tenantContextService.getOrThrow();

    if (request.name !== undefined || request.description !== undefined) {
      await this.workflowRepository.update(id, {
        name: request.name,
        description: request.description,
      });
    }

    if (request.definition) {
      this.workflowDefinitionValidatorService.validate(request.definition);
      const latest = await this.workflowVersionRepository.findLatest(id);
      const nextVersion = (latest?.version ?? 0) + 1;
      await this.workflowVersionRepository.create({
        workflowId: id,
        version: nextVersion,
        definition: request.definition,
        createdBy: tenant.userId,
      });
    }

    await this.auditService.record({
      action: 'update',
      resource: 'workflow',
      resourceId: id,
      metadata: { name: request.name, hasNewVersion: Boolean(request.definition) },
    });

    const updated = await this.workflowRepository.findById(id);
    if (!updated) {
      throw new NotFoundException(`Workflow with id "${id}" not found`);
    }
    return updated;
  }

  async publishWorkflow(id: string): Promise<WorkflowEntity> {
    const workflow = await this.getWorkflowOrThrow(id);
    const latest = await this.workflowVersionRepository.findLatest(id);
    if (!latest) {
      throw new BadRequestException(`Workflow "${workflow.name}" has no versions to publish`);
    }

    const published = await this.workflowRepository.setStatus(id, 'PUBLISHED', latest.version);
    if (!published) {
      throw new NotFoundException(`Workflow with id "${id}" not found`);
    }

    await this.auditService.record({
      action: 'publish',
      resource: 'workflow',
      resourceId: id,
      metadata: { version: latest.version },
    });

    return published;
  }

  async archiveWorkflow(id: string): Promise<WorkflowEntity> {
    const archived = await this.workflowRepository.setStatus(id, 'ARCHIVED');
    if (!archived) {
      throw new NotFoundException(`Workflow with id "${id}" not found`);
    }

    await this.auditService.record({
      action: 'archive',
      resource: 'workflow',
      resourceId: id,
      metadata: {},
    });

    return archived;
  }

  async deleteWorkflow(id: string): Promise<WorkflowEntity> {
    const deleted = await this.workflowRepository.softDelete(id);
    if (!deleted) {
      throw new NotFoundException(`Workflow with id "${id}" not found`);
    }

    await this.auditService.record({
      action: 'delete',
      resource: 'workflow',
      resourceId: id,
      metadata: { name: deleted.name },
    });

    return deleted;
  }

  async listVersions(workflowId: string): Promise<WorkflowVersionEntity[]> {
    await this.getWorkflowOrThrow(workflowId);
    return this.workflowVersionRepository.listByWorkflow(workflowId);
  }

  /**
   * Creates the run (resolving the published version, honoring
   * idempotency) but does not drive it — callers decide whether to drain
   * (runWorkflow) or stream (runWorkflowStream) the actual execution.
   */
  async createRun(workflowId: string, request: RunWorkflowRequest): Promise<WorkflowRunEntity> {
    const workflow = await this.getWorkflowOrThrow(workflowId);
    if (workflow.status !== 'PUBLISHED' || workflow.publishedVersion === null) {
      throw new BadRequestException(`Workflow "${workflow.name}" is not published`);
    }

    if (request.idempotencyKey) {
      const existing = await this.workflowRunRepository.findByIdempotencyKey(
        workflowId,
        request.idempotencyKey,
      );
      if (existing) {
        return existing;
      }
    }

    const version = await this.workflowVersionRepository.findByWorkflowAndVersion(
      workflowId,
      workflow.publishedVersion,
    );
    if (!version) {
      throw new NotFoundException(
        `Published version ${workflow.publishedVersion} of workflow "${workflow.name}" not found`,
      );
    }

    const conversation = await this.createRunConversation(workflow.name, version.definition);

    const run = await this.workflowRunRepository.create({
      workflowId,
      workflowVersionId: version.id,
      conversationId: conversation.id,
      triggerType: request.triggerType ?? 'MANUAL',
      input: request.input,
      idempotencyKey: request.idempotencyKey,
      triggeredBy: request.triggeredBy,
    });

    await this.auditService.record({
      action: 'run',
      resource: 'workflow',
      resourceId: workflowId,
      metadata: { runId: run.id, triggerType: run.triggerType },
    });

    return run;
  }

  // Every run gets a bookkeeping Conversation (AGENT steps append their
  // turns to it; DELAY/API/WEBHOOK/etc. steps never touch it). Its
  // provider/model columns are NOT NULL, so creating it normally requires
  // resolving a real, enabled AI provider — which a run with zero AGENT
  // steps has no actual need for. Only fall back to the configured default
  // provider/model as inert bookkeeping labels when no provider is enabled
  // AND the definition has no AGENT step to legitimately require one;
  // otherwise the "No AI providers are enabled" error is correct and
  // should still surface.
  private async createRunConversation(
    workflowName: string,
    definition: WorkflowDefinition,
  ): Promise<ConversationResponseDto> {
    try {
      return await this.conversationService.createConversation({
        title: `Workflow: ${workflowName}`,
      });
    } catch (error) {
      const hasAgentStep = definition.steps.some((step) => step.type === 'AGENT');
      if (!(error instanceof ServiceUnavailableException) || hasAgentStep) {
        throw error;
      }

      return this.conversationService.createConversation({
        title: `Workflow: ${workflowName}`,
        provider: this.configService.get<AIProviderName>('ai.defaultProvider', 'openai'),
        model: this.configService.get<string>('ai.defaultModel', 'gpt-5-mini'),
      });
    }
  }

  async runWorkflow(
    workflowId: string,
    request: RunWorkflowRequest,
    grantedPermissions: string[] = [],
  ): Promise<WorkflowRunEntity> {
    const run = await this.createRun(workflowId, request);
    if (run.status !== 'PENDING') {
      return run;
    }
    await drainToReturnValue(this.workflowEngineService.executeRun(run.id, grantedPermissions));
    return this.getRunOrThrow(run.id);
  }

  async *runWorkflowStream(
    workflowId: string,
    request: RunWorkflowRequest,
    grantedPermissions: string[] = [],
    signal?: AbortSignal,
  ): AsyncGenerator<WorkflowStreamEvent, WorkflowRunEntity> {
    const run = await this.createRun(workflowId, request);
    return yield* this.driveRun(run.id, grantedPermissions, signal);
  }

  private async *driveRun(
    runId: string,
    grantedPermissions: string[],
    signal?: AbortSignal,
  ): AsyncGenerator<WorkflowStreamEvent, WorkflowRunEntity> {
    if (this.workflowEngineService.isActiveInProcess(runId)) {
      throw new ConflictException(`Workflow run "${runId}" is already executing`);
    }

    const onAbort = () => this.workflowEngineService.cancelInProcess(runId);
    signal?.addEventListener('abort', onAbort);

    try {
      const generator = this.workflowEngineService.executeRun(runId, grantedPermissions);
      let step = await generator.next();
      while (!step.done) {
        yield step.value;
        step = await generator.next();
      }
    } finally {
      signal?.removeEventListener('abort', onAbort);
    }

    return this.getRunOrThrow(runId);
  }

  async getRunOrThrow(runId: string): Promise<WorkflowRunEntity> {
    const run = await this.workflowRunRepository.findById(runId);
    if (!run) {
      throw new NotFoundException(`Workflow run with id "${runId}" not found`);
    }
    return run;
  }

  async listRuns(params: FindWorkflowRunsParams): Promise<PaginatedWorkflowRuns> {
    return this.workflowRunRepository.findAll(params);
  }

  async pauseRun(runId: string): Promise<WorkflowRunEntity> {
    const run = await this.getRunOrThrow(runId);
    if (run.status !== 'RUNNING') {
      throw new BadRequestException(
        `Workflow run "${runId}" is not running (status: ${run.status})`,
      );
    }
    const paused = await this.workflowRunRepository.updateWithVersion(runId, run.version, {
      status: 'PAUSED',
    });
    await this.auditService.record({
      action: 'pause',
      resource: 'workflow_run',
      resourceId: runId,
      metadata: {},
    });
    return paused;
  }

  async resumeRun(runId: string, grantedPermissions: string[] = []): Promise<WorkflowRunEntity> {
    const run = await this.getRunOrThrow(runId);
    if (run.status !== 'PAUSED' && run.status !== 'WAITING_APPROVAL') {
      throw new BadRequestException(
        `Workflow run "${runId}" cannot be resumed (status: ${run.status})`,
      );
    }
    await drainToReturnValue(this.workflowEngineService.executeRun(runId, grantedPermissions));
    await this.auditService.record({
      action: 'resume',
      resource: 'workflow_run',
      resourceId: runId,
      metadata: {},
    });
    return this.getRunOrThrow(runId);
  }

  async *resumeRunStream(
    runId: string,
    grantedPermissions: string[] = [],
    signal?: AbortSignal,
  ): AsyncGenerator<WorkflowStreamEvent, WorkflowRunEntity> {
    const run = await this.getRunOrThrow(runId);
    if (run.status !== 'PAUSED' && run.status !== 'WAITING_APPROVAL') {
      throw new BadRequestException(
        `Workflow run "${runId}" cannot be resumed (status: ${run.status})`,
      );
    }
    return yield* this.driveRun(runId, grantedPermissions, signal);
  }

  async cancelRun(runId: string): Promise<WorkflowRunEntity> {
    const run = await this.getRunOrThrow(runId);
    if (['SUCCEEDED', 'FAILED', 'CANCELLED'].includes(run.status)) {
      throw new BadRequestException(
        `Workflow run "${runId}" is already terminal (status: ${run.status})`,
      );
    }

    const cancelled = await this.workflowRunRepository.updateWithVersion(runId, run.version, {
      status: 'CANCELLED',
      completedAt: new Date(),
    });
    this.workflowEngineService.cancelInProcess(runId);

    await this.workflowLogRepository.create({
      workflowRunId: runId,
      event: 'WorkflowCancelled',
      message: 'Workflow run cancelled',
    });
    await this.auditService.record({
      action: 'cancel',
      resource: 'workflow_run',
      resourceId: runId,
      metadata: {},
    });

    return cancelled;
  }

  async retryRun(runId: string, grantedPermissions: string[] = []): Promise<WorkflowRunEntity> {
    const run = await this.getRunOrThrow(runId);
    if (run.status !== 'FAILED') {
      throw new BadRequestException(
        `Workflow run "${runId}" is not failed (status: ${run.status})`,
      );
    }

    await this.workflowStepRunRepository.resetFailedForRetry(runId);
    await this.workflowRunRepository.updateWithVersion(runId, run.version, {
      status: 'PAUSED',
      error: null,
    });

    await this.auditService.record({
      action: 'retry',
      resource: 'workflow_run',
      resourceId: runId,
      metadata: {},
    });

    await drainToReturnValue(this.workflowEngineService.executeRun(runId, grantedPermissions));
    return this.getRunOrThrow(runId);
  }

  async decideApproval(
    approvalId: string,
    decision: Extract<WorkflowApprovalStatus, 'APPROVED' | 'REJECTED'>,
    approverUserId: string,
    comment?: string,
    grantedPermissions: string[] = [],
  ): Promise<WorkflowApprovalEntity> {
    const approval = await this.workflowApprovalRepository.findById(approvalId);
    if (!approval) {
      throw new NotFoundException(`Approval with id "${approvalId}" not found`);
    }
    if (approval.status !== 'PENDING') {
      throw new BadRequestException(`Approval "${approvalId}" has already been decided`);
    }

    const decided = await this.workflowApprovalRepository.decide(
      approvalId,
      decision,
      approverUserId,
      comment,
    );

    await this.auditService.record({
      action: 'decide_approval',
      resource: 'workflow_approval',
      resourceId: approvalId,
      metadata: { decision, workflowRunId: approval.workflowRunId },
    });

    await drainToReturnValue(
      this.workflowEngineService.executeRun(approval.workflowRunId, grantedPermissions),
    );

    return decided;
  }

  async listLogs(runId: string, page: number, limit: number) {
    return this.workflowLogRepository.listByRun(runId, page, limit);
  }

  async listCheckpoints(runId: string) {
    return this.workflowCheckpointRepository.listByRun(runId);
  }

  async listDeadLetters(page: number, limit: number) {
    return this.workflowDeadLetterRepository.findAll(page, limit);
  }
}
