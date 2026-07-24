import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
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
import { AUTH_GUARDS } from '../../../common/guards/protected.guards';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentUser as CurrentUserInterface } from '../../auth/interfaces/current-user.interface';
import { Permissions } from '../../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../../permissions/guards/permission.guard';
import { writeGatewayEventStreamToResponse } from '../streaming/write-gateway-stream-to-response';
import { AgentVersionService } from './agent-version.service';
import { AgentService } from './agent.service';
import { RunAutonomousAgentDto } from './dto/autonomous-agent.dto';
import {
  CreateAgentScheduleDto,
  AgentScheduleResponseDto,
  AgentScheduleSuccessResponseDto,
  AgentSchedulesSuccessResponseDto,
  UpdateAgentScheduleEnabledDto,
} from './dto/agent-schedule.dto';
import {
  AgentVersionResponseDto,
  AgentVersionSuccessResponseDto,
  AgentVersionsSuccessResponseDto,
  CreateAgentVersionDto,
  PublishAgentVersionDto,
  RollbackAgentVersionDto,
} from './dto/agent-version.dto';
import {
  AgentRunResponseDto,
  AgentRunSuccessResponseDto,
  AgentStatsResponseDto,
  AgentStatsSuccessResponseDto,
  AgentSuccessResponseDto,
  AgentsSuccessResponseDto,
  CreateAgentDto,
  ListAgentExecutionsQueryDto,
  PaginatedAgentRunsDto,
  PaginatedAgentRunsSuccessResponseDto,
  RunAgentDto,
  RunAgentResponseDto,
  TestRunAgentDto,
  UpdateAgentDto,
  AgentResponseDto,
} from './dto/agent.dto';
import { AgentScheduleService } from './scheduling/agent-schedule.service';

@ApiTags('AI Agents')
@ApiBearerAuth('JWT')
@Controller('ai/agents')
export class AgentController {
  constructor(
    private readonly agentService: AgentService,
    private readonly agentVersionService: AgentVersionService,
    private readonly agentScheduleService: AgentScheduleService,
  ) {}

  @Get()
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('ai.agent.read')
  @ApiOperation({ summary: 'List AI agents available to the current organization' })
  @ApiOkResponse({ type: AgentsSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  list(): Promise<AgentResponseDto[]> {
    return this.agentService.listAgents();
  }

  @Post()
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('ai.agent.create')
  @ApiOperation({ summary: 'Create a custom AI agent' })
  @ApiCreatedResponse({ type: AgentSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  create(@Body() dto: CreateAgentDto): Promise<AgentResponseDto> {
    return this.agentService.createAgent(dto);
  }

  @Patch(':id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('ai.agent.update')
  @ApiOperation({ summary: 'Update an AI agent' })
  @ApiOkResponse({ type: AgentSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAgentDto,
  ): Promise<AgentResponseDto> {
    return this.agentService.updateAgent(id, dto);
  }

  @Delete(':id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('ai.agent.delete')
  @ApiOperation({ summary: 'Soft delete an AI agent' })
  @ApiOkResponse({ type: AgentSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<AgentResponseDto> {
    return this.agentService.deleteAgent(id);
  }

  @Get(':id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('ai.agent.read')
  @ApiOperation({ summary: 'Get a single AI agent by id' })
  @ApiOkResponse({ type: AgentSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  getOne(@Param('id', ParseUUIDPipe) id: string): Promise<AgentResponseDto> {
    return this.agentService.getAgent(id);
  }

  @Get(':id/stats')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('ai.agent.read')
  @ApiOperation({ summary: 'Get real usage stats for an AI agent (tool count, runs, last run)' })
  @ApiOkResponse({ type: AgentStatsSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  getStats(@Param('id', ParseUUIDPipe) id: string): Promise<AgentStatsResponseDto> {
    return this.agentService.getAgentStats(id);
  }

  @Post(':id/versions')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('ai.agent.update')
  @ApiOperation({ summary: 'Snapshot the agent\'s current config as a new immutable version' })
  @ApiCreatedResponse({ type: AgentVersionSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  createVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateAgentVersionDto,
  ): Promise<AgentVersionResponseDto> {
    return this.agentVersionService.createVersion(id, dto);
  }

  @Get(':id/versions')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('ai.agent.read')
  @ApiOperation({ summary: 'List an agent\'s version history' })
  @ApiOkResponse({ type: AgentVersionsSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  listVersions(@Param('id', ParseUUIDPipe) id: string): Promise<AgentVersionResponseDto[]> {
    return this.agentVersionService.listVersions(id);
  }

  @Get(':id/history')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('ai.agent.read')
  @ApiOperation({ summary: 'Alias of GET /:id/versions — an agent\'s version history' })
  @ApiOkResponse({ type: AgentVersionsSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  getHistory(@Param('id', ParseUUIDPipe) id: string): Promise<AgentVersionResponseDto[]> {
    return this.agentVersionService.listVersions(id);
  }

  @Post(':id/publish')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('ai.agent.publish')
  @ApiOperation({ summary: 'Publish a version (defaults to latest) as the agent\'s live config' })
  @ApiCreatedResponse({ type: AgentSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  publish(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PublishAgentVersionDto,
  ): Promise<AgentResponseDto> {
    return this.agentVersionService.publish(id, dto);
  }

  @Post(':id/archive')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('ai.agent.publish')
  @ApiOperation({ summary: 'Archive an agent, preventing further runs' })
  @ApiCreatedResponse({ type: AgentSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  archive(@Param('id', ParseUUIDPipe) id: string): Promise<AgentResponseDto> {
    return this.agentVersionService.archive(id);
  }

  @Post(':id/rollback')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('ai.agent.publish')
  @ApiOperation({ summary: 'Roll the agent\'s live config back to an older version' })
  @ApiCreatedResponse({ type: AgentSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  rollback(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RollbackAgentVersionDto,
  ): Promise<AgentResponseDto> {
    return this.agentVersionService.rollback(id, dto);
  }

  @Post(':id/test')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('ai.agent.test')
  @ApiOperation({
    summary: 'Test-run an agent (defaults to its latest draft version) without affecting production',
  })
  @ApiCreatedResponse({ type: AgentRunSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  test(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: TestRunAgentDto,
    @CurrentUser() user: CurrentUserInterface,
  ): Promise<RunAgentResponseDto> {
    return this.agentService.testRunAgent(id, dto, user.permissions);
  }

  @Get(':id/executions')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('ai.agent.read')
  @ApiOperation({ summary: 'Paginated run/execution history for one agent' })
  @ApiOkResponse({ type: PaginatedAgentRunsSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  listExecutions(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListAgentExecutionsQueryDto,
  ): Promise<PaginatedAgentRunsDto> {
    return this.agentService.listExecutionsForAgent(id, query);
  }

  @Post(':id/schedules')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('ai.agent.schedule')
  @ApiOperation({ summary: 'Create a CRON/EVENT schedule for an agent' })
  @ApiCreatedResponse({ type: AgentScheduleSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  createSchedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateAgentScheduleDto,
  ): Promise<AgentScheduleResponseDto> {
    return this.agentScheduleService
      .createSchedule({ agentId: id, ...dto })
      .then((schedule) => AgentScheduleResponseDto.fromEntity(schedule));
  }

  @Get(':id/schedules')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('ai.agent.read')
  @ApiOperation({ summary: "List an agent's schedules" })
  @ApiOkResponse({ type: AgentSchedulesSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  listSchedules(@Param('id', ParseUUIDPipe) id: string): Promise<AgentScheduleResponseDto[]> {
    return this.agentScheduleService
      .listSchedules(id)
      .then((schedules) => schedules.map((schedule) => AgentScheduleResponseDto.fromEntity(schedule)));
  }

  @Patch(':id/schedules/:scheduleId')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('ai.agent.schedule')
  @ApiOperation({ summary: 'Enable or disable an agent schedule' })
  @ApiOkResponse({ type: AgentScheduleSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  setScheduleEnabled(
    @Param('scheduleId', ParseUUIDPipe) scheduleId: string,
    @Body() dto: UpdateAgentScheduleEnabledDto,
  ): Promise<AgentScheduleResponseDto> {
    return this.agentScheduleService
      .setEnabled(scheduleId, dto.enabled)
      .then((schedule) => AgentScheduleResponseDto.fromEntity(schedule));
  }

  @Post(':id/run')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('ai.agent.run')
  @ApiOperation({ summary: 'Run an AI agent against a conversation' })
  @ApiCreatedResponse({ type: AgentRunSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  run(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RunAgentDto,
    @CurrentUser() user: CurrentUserInterface,
  ): Promise<RunAgentResponseDto> {
    return this.agentService.runAgent(id, dto, user.permissions);
  }

  @Post(':id/run/stream')
  @HttpCode(HttpStatus.OK)
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('ai.agent.run')
  @ApiOperation({ summary: 'Run an AI agent and stream progress over Server-Sent Events' })
  @ApiConsumes('application/json')
  @ApiProduces('text/event-stream')
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async runStream(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RunAgentDto,
    @CurrentUser() user: CurrentUserInterface,
    @Res() response: Response,
  ): Promise<void> {
    await writeGatewayEventStreamToResponse(response, (signal) =>
      this.agentService.runAgentStream(id, dto, user.permissions, signal),
    );
  }

  @Post(':id/run/autonomous')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('ai.agent.run')
  @ApiOperation({
    summary:
      'Run an AI agent autonomously: plan, reason, choose tools, execute, and iterate until the objective is complete',
  })
  @ApiCreatedResponse({ type: AgentRunSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  runAutonomous(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RunAutonomousAgentDto,
    @CurrentUser() user: CurrentUserInterface,
  ): Promise<RunAgentResponseDto> {
    return this.agentService.runAutonomousAgent(id, dto, user.permissions);
  }

  @Post(':id/run/autonomous/stream')
  @HttpCode(HttpStatus.OK)
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('ai.agent.run')
  @ApiOperation({
    summary: 'Run an AI agent autonomously and stream planning/reasoning/tool progress over SSE',
  })
  @ApiConsumes('application/json')
  @ApiProduces('text/event-stream')
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  async runAutonomousStream(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RunAutonomousAgentDto,
    @CurrentUser() user: CurrentUserInterface,
    @Res() response: Response,
  ): Promise<void> {
    await writeGatewayEventStreamToResponse(response, (signal) =>
      this.agentService.runAutonomousAgentStream(id, dto, user.permissions, signal),
    );
  }

  @Get('runs/:runId/tree')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('ai.agent.read')
  @ApiOperation({
    summary:
      'Get the full execution tree (root run plus every delegated descendant) for an agent run',
  })
  @ApiOkResponse({ type: [AgentRunResponseDto] })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid authentication context' })
  getExecutionTree(@Param('runId', ParseUUIDPipe) runId: string): Promise<AgentRunResponseDto[]> {
    return this.agentService.getExecutionTree(runId);
  }
}
