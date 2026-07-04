import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { AUTH_GUARDS } from '../../../common/guards/protected.guards';
import { Permissions } from '../../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../../permissions/guards/permission.guard';
import { AgentService } from './agent.service';
import {
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
  ): Promise<RunAgentResponseDto> {
    return this.agentService.runAgent(id, dto);
  }
}
