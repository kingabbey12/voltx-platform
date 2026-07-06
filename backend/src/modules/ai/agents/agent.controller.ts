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
import { AgentService } from './agent.service';
import { RunAutonomousAgentDto } from './dto/autonomous-agent.dto';
import {
  AgentRunResponseDto,
  AgentRunSuccessResponseDto,
  AgentSuccessResponseDto,
  AgentsSuccessResponseDto,
  CreateAgentDto,
  RunAgentDto,
  RunAgentResponseDto,
  UpdateAgentDto,
  AgentResponseDto,
} from './dto/agent.dto';

@ApiTags('AI Agents')
@ApiBearerAuth('JWT')
@Controller('ai/agents')
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

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
