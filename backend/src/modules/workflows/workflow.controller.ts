import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Response } from 'express';
import { AUTH_GUARDS } from '../../common/guards/protected.guards';
import { writeEventStreamToResponse } from '../ai/streaming/write-event-stream-to-response';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentUser as CurrentUserInterface } from '../auth/interfaces/current-user.interface';
import { Permissions } from '../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../permissions/guards/permission.guard';
import { DecideApprovalDto, WorkflowApprovalResponseDto } from './dto/workflow-approval.dto';
import {
  ListWorkflowDeadLettersQueryDto,
  ListWorkflowLogsQueryDto,
  PaginatedWorkflowDeadLettersResponseDto,
  PaginatedWorkflowLogsResponseDto,
  WorkflowCheckpointResponseDto,
  WorkflowCheckpointsSuccessResponseDto,
  WorkflowDeadLetterResponseDto,
  WorkflowHealthDto,
  WorkflowLogResponseDto,
  WorkflowMetricsDto,
} from './dto/workflow-observability.dto';
import {
  ListWorkflowRunsQueryDto,
  PaginatedWorkflowRunsResponseDto,
  RunWorkflowDto,
  WorkflowRunResponseDto,
} from './dto/workflow-run.dto';
import {
  CreateWorkflowScheduleDto,
  SetScheduleEnabledDto,
  WorkflowScheduleResponseDto,
  WorkflowSchedulesSuccessResponseDto,
  WorkflowScheduleSuccessResponseDto,
} from './dto/workflow-schedule.dto';
import {
  CreateWorkflowDto,
  ListWorkflowsQueryDto,
  PaginatedWorkflowsResponseDto,
  UpdateWorkflowDto,
  WorkflowResponseDto,
  WorkflowSuccessResponseDto,
  WorkflowVersionResponseDto,
  WorkflowVersionsSuccessResponseDto,
} from './dto/workflow.dto';
import { WorkflowScheduleService } from './scheduling/workflow-schedule.service';
import { WorkflowStatsService } from './observability/workflow-stats.service';
import { WorkflowService } from './workflow.service';

@ApiTags('Workflows')
@ApiBearerAuth('JWT')
@Controller('workflows')
export class WorkflowController {
  constructor(
    private readonly workflowService: WorkflowService,
    private readonly workflowScheduleService: WorkflowScheduleService,
    private readonly workflowStatsService: WorkflowStatsService,
  ) {}

  @Post()
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('workflow.create')
  @ApiOperation({ summary: 'Create a workflow (as a first draft version)' })
  @ApiCreatedResponse({ type: WorkflowSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async create(@Body() dto: CreateWorkflowDto): Promise<WorkflowResponseDto> {
    const workflow = await this.workflowService.createWorkflow(dto);
    return WorkflowResponseDto.fromEntity(workflow);
  }

  @Get()
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('workflow.read')
  @ApiOperation({ summary: 'List workflows' })
  @ApiOkResponse({ type: PaginatedWorkflowsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async list(@Query() query: ListWorkflowsQueryDto) {
    const result = await this.workflowService.listWorkflows({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      status: query.status,
      search: query.search,
    });
    return { ...result, items: result.items.map((item) => WorkflowResponseDto.fromEntity(item)) };
  }

  @Get('dead-letters')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('workflow.admin')
  @ApiOperation({ summary: 'List steps that exhausted retries (the dead letter queue)' })
  @ApiOkResponse({ type: PaginatedWorkflowDeadLettersResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async listDeadLetters(@Query() query: ListWorkflowDeadLettersQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { items, total } = await this.workflowService.listDeadLetters(page, limit);
    return {
      items: items.map((item) => WorkflowDeadLetterResponseDto.fromEntity(item)),
      total,
      page,
      limit,
    };
  }

  // NOTE: this route MUST be registered before ':id' — Express/Nest match
  // routes in registration order, and ':id' matches any single path
  // segment, so a literal route like this one has to come first or a
  // request for it would be swallowed by ':id' instead.
  @Get(':id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('workflow.read')
  @ApiOperation({ summary: 'Get a workflow' })
  @ApiOkResponse({ type: WorkflowSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async getById(@Param('id') id: string): Promise<WorkflowResponseDto> {
    const workflow = await this.workflowService.getWorkflowOrThrow(id);
    return WorkflowResponseDto.fromEntity(workflow);
  }

  @Patch(':id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('workflow.create')
  @ApiOperation({ summary: 'Update a workflow (providing definition creates a new version)' })
  @ApiOkResponse({ type: WorkflowSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateWorkflowDto,
  ): Promise<WorkflowResponseDto> {
    const workflow = await this.workflowService.updateWorkflow(id, dto);
    return WorkflowResponseDto.fromEntity(workflow);
  }

  @Post(':id/publish')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('workflow.publish')
  @ApiOperation({ summary: 'Publish the latest version of a workflow' })
  @ApiCreatedResponse({ type: WorkflowSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async publish(@Param('id') id: string): Promise<WorkflowResponseDto> {
    const workflow = await this.workflowService.publishWorkflow(id);
    return WorkflowResponseDto.fromEntity(workflow);
  }

  @Post(':id/archive')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('workflow.publish')
  @ApiOperation({ summary: 'Archive a workflow' })
  @ApiCreatedResponse({ type: WorkflowSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async archive(@Param('id') id: string): Promise<WorkflowResponseDto> {
    const workflow = await this.workflowService.archiveWorkflow(id);
    return WorkflowResponseDto.fromEntity(workflow);
  }

  @Delete(':id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('workflow.delete')
  @ApiOperation({ summary: 'Soft delete a workflow' })
  @ApiOkResponse({ type: WorkflowSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async remove(@Param('id') id: string): Promise<WorkflowResponseDto> {
    const workflow = await this.workflowService.deleteWorkflow(id);
    return WorkflowResponseDto.fromEntity(workflow);
  }

  @Get(':id/versions')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('workflow.read')
  @ApiOperation({ summary: 'List every version of a workflow' })
  @ApiOkResponse({ type: WorkflowVersionsSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async listVersions(@Param('id') id: string): Promise<WorkflowVersionResponseDto[]> {
    const versions = await this.workflowService.listVersions(id);
    return versions.map((version) => WorkflowVersionResponseDto.fromEntity(version));
  }

  @Post(':id/schedules')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('workflow.admin')
  @ApiOperation({ summary: 'Create a CRON/DELAYED/EVENT schedule for a workflow' })
  @ApiCreatedResponse({ type: WorkflowScheduleSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async createSchedule(
    @Param('id') id: string,
    @Body() dto: CreateWorkflowScheduleDto,
  ): Promise<WorkflowScheduleResponseDto> {
    const schedule = await this.workflowScheduleService.createSchedule({
      workflowId: id,
      ...dto,
    });
    return WorkflowScheduleResponseDto.fromEntity(schedule);
  }

  @Get(':id/schedules')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('workflow.admin')
  @ApiOperation({ summary: 'List a workflow’s schedules' })
  @ApiOkResponse({ type: WorkflowSchedulesSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async listSchedules(@Param('id') id: string): Promise<WorkflowScheduleResponseDto[]> {
    const schedules = await this.workflowScheduleService.listSchedules(id);
    return schedules.map((schedule) => WorkflowScheduleResponseDto.fromEntity(schedule));
  }

  @Patch(':id/schedules/:scheduleId')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('workflow.admin')
  @ApiOperation({ summary: 'Enable or disable a schedule' })
  @ApiOkResponse({ type: WorkflowScheduleSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async setScheduleEnabled(
    @Param('scheduleId') scheduleId: string,
    @Body() dto: SetScheduleEnabledDto,
  ): Promise<WorkflowScheduleResponseDto> {
    const schedule = await this.workflowScheduleService.setEnabled(scheduleId, dto.enabled);
    return WorkflowScheduleResponseDto.fromEntity(schedule);
  }

  @Post(':id/run')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('workflow.run')
  @ApiOperation({ summary: 'Run a workflow to completion (or until paused/waiting-approval)' })
  @ApiCreatedResponse({ type: WorkflowRunResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async run(
    @Param('id') id: string,
    @Body() dto: RunWorkflowDto,
    @CurrentUser() user: CurrentUserInterface,
  ): Promise<WorkflowRunResponseDto> {
    const run = await this.workflowService.runWorkflow(
      id,
      { ...dto, triggeredBy: user.id },
      user.permissions,
    );
    return WorkflowRunResponseDto.fromEntity(run);
  }

  @Post(':id/run/stream')
  @HttpCode(HttpStatus.OK)
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('workflow.run')
  @ApiOperation({ summary: 'Run a workflow and stream every lifecycle/step event over SSE' })
  @ApiConsumes('application/json')
  @ApiProduces('text/event-stream')
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async runStream(
    @Param('id') id: string,
    @Body() dto: RunWorkflowDto,
    @CurrentUser() user: CurrentUserInterface,
    @Res() response: Response,
  ): Promise<void> {
    await writeEventStreamToResponse(response, (signal) =>
      this.workflowService.runWorkflowStream(
        id,
        { ...dto, triggeredBy: user.id },
        user.permissions,
        signal,
      ),
    );
  }

  @Get(':id/runs')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('workflow.read')
  @ApiOperation({ summary: 'Workflow run history' })
  @ApiOkResponse({ type: PaginatedWorkflowRunsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async listRuns(@Param('id') id: string, @Query() query: ListWorkflowRunsQueryDto) {
    const result = await this.workflowService.listRuns({
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      workflowId: id,
      status: query.status,
    });
    return { ...result, items: result.items.map((run) => WorkflowRunResponseDto.fromEntity(run)) };
  }

  @Get(':id/metrics')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('workflow.admin')
  @ApiOperation({
    summary: 'Workflow execution metrics (time, retries, success rate, cost, usage)',
  })
  @ApiOkResponse({ type: WorkflowMetricsDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async getMetrics(@Param('id') id: string): Promise<WorkflowMetricsDto> {
    const metrics = await this.workflowStatsService.getMetrics(id);
    return WorkflowMetricsDto.fromMetrics(metrics);
  }

  @Get(':id/health')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('workflow.admin')
  @ApiOperation({ summary: 'Coarse workflow health signal' })
  @ApiOkResponse({ type: WorkflowHealthDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async getHealth(@Param('id') id: string): Promise<WorkflowHealthDto> {
    return this.workflowStatsService.getHealth(id);
  }

  @Get('runs/:runId')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('workflow.read')
  @ApiOperation({ summary: 'Get a workflow run' })
  @ApiOkResponse({ type: WorkflowRunResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async getRun(@Param('runId') runId: string): Promise<WorkflowRunResponseDto> {
    const run = await this.workflowService.getRunOrThrow(runId);
    return WorkflowRunResponseDto.fromEntity(run);
  }

  @Post('runs/:runId/pause')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('workflow.run')
  @ApiOperation({ summary: 'Pause a running workflow run' })
  @ApiCreatedResponse({ type: WorkflowRunResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async pause(@Param('runId') runId: string): Promise<WorkflowRunResponseDto> {
    const run = await this.workflowService.pauseRun(runId);
    return WorkflowRunResponseDto.fromEntity(run);
  }

  @Post('runs/:runId/resume')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('workflow.run')
  @ApiOperation({ summary: 'Resume a paused or waiting-approval workflow run' })
  @ApiCreatedResponse({ type: WorkflowRunResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async resume(
    @Param('runId') runId: string,
    @CurrentUser() user: CurrentUserInterface,
  ): Promise<WorkflowRunResponseDto> {
    const run = await this.workflowService.resumeRun(runId, user.permissions);
    return WorkflowRunResponseDto.fromEntity(run);
  }

  @Post('runs/:runId/resume/stream')
  @HttpCode(HttpStatus.OK)
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('workflow.run')
  @ApiOperation({ summary: 'Resume a workflow run and stream lifecycle/step events over SSE' })
  @ApiConsumes('application/json')
  @ApiProduces('text/event-stream')
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async resumeStream(
    @Param('runId') runId: string,
    @CurrentUser() user: CurrentUserInterface,
    @Res() response: Response,
  ): Promise<void> {
    await writeEventStreamToResponse(response, (signal) =>
      this.workflowService.resumeRunStream(runId, user.permissions, signal),
    );
  }

  @Post('runs/:runId/cancel')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('workflow.run')
  @ApiOperation({ summary: 'Cancel a workflow run' })
  @ApiCreatedResponse({ type: WorkflowRunResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async cancel(@Param('runId') runId: string): Promise<WorkflowRunResponseDto> {
    const run = await this.workflowService.cancelRun(runId);
    return WorkflowRunResponseDto.fromEntity(run);
  }

  @Post('runs/:runId/retry')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('workflow.run')
  @ApiOperation({ summary: 'Retry a failed workflow run (only its failed steps re-execute)' })
  @ApiCreatedResponse({ type: WorkflowRunResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async retry(
    @Param('runId') runId: string,
    @CurrentUser() user: CurrentUserInterface,
  ): Promise<WorkflowRunResponseDto> {
    const run = await this.workflowService.retryRun(runId, user.permissions);
    return WorkflowRunResponseDto.fromEntity(run);
  }

  @Get('runs/:runId/logs')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('workflow.read')
  @ApiOperation({ summary: 'Workflow run execution logs' })
  @ApiOkResponse({ type: PaginatedWorkflowLogsResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async listLogs(@Param('runId') runId: string, @Query() query: ListWorkflowLogsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 50;
    const { items, total } = await this.workflowService.listLogs(runId, page, limit);
    return {
      items: items.map((item) => WorkflowLogResponseDto.fromEntity(item)),
      total,
      page,
      limit,
    };
  }

  @Get('runs/:runId/checkpoints')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('workflow.read')
  @ApiOperation({ summary: 'List the checkpoint history for a workflow run' })
  @ApiOkResponse({ type: WorkflowCheckpointsSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async listCheckpoints(@Param('runId') runId: string): Promise<WorkflowCheckpointResponseDto[]> {
    const checkpoints = await this.workflowService.listCheckpoints(runId);
    return checkpoints.map((checkpoint) => WorkflowCheckpointResponseDto.fromEntity(checkpoint));
  }

  @Post('approvals/:approvalId/decide')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('workflow.approve')
  @ApiOperation({ summary: 'Approve or reject a pending workflow approval step' })
  @ApiCreatedResponse({ type: WorkflowApprovalResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async decideApproval(
    @Param('approvalId') approvalId: string,
    @Body() dto: DecideApprovalDto,
    @CurrentUser() user: CurrentUserInterface,
  ): Promise<WorkflowApprovalResponseDto> {
    const approval = await this.workflowService.decideApproval(
      approvalId,
      dto.decision,
      user.id,
      dto.comment,
      user.permissions,
    );
    return WorkflowApprovalResponseDto.fromEntity(approval);
  }
}
