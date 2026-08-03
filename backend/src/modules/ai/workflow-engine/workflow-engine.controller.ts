import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';
import { AUTH_GUARDS } from '../../../common/guards/protected.guards';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentUser as CurrentUserInterface } from '../../auth/interfaces/current-user.interface';
import { Permissions } from '../../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../../permissions/guards/permission.guard';
import { writeGatewayEventStreamToResponse } from '../streaming/write-gateway-stream-to-response';
import { WorkflowPlanApprovalService } from './workflow-engine.approval';
import {
  GenerateWorkflowPlansDto,
  HandOffWorkflowPlanDto,
  WorkflowPlanHandoffResponseDto,
  WorkflowPlanResponseDto,
  WorkflowPlansResponseDto,
} from './workflow-engine.dto';
import { WorkflowPlanExecutionHandoff } from './workflow-engine.handoff';
import { AutonomousWorkflowPlansService } from './workflow-engine.service';

@ApiTags('AI Workflow Plans')
@ApiBearerAuth('JWT')
@UseGuards(...AUTH_GUARDS, PermissionGuard)
@Controller('ai/workflow-plans')
export class AutonomousWorkflowPlansController {
  constructor(
    private readonly plans: AutonomousWorkflowPlansService,
    private readonly approvals: WorkflowPlanApprovalService,
    private readonly handoff: WorkflowPlanExecutionHandoff,
  ) {}

  @Get()
  @Permissions('ai.agent.run')
  @ApiOperation({ summary: 'List this tenant’s stored workflow plans with live approval state' })
  @ApiOkResponse({ type: [WorkflowPlanResponseDto] })
  list() {
    return this.plans.list();
  }

  @Get(':id')
  @Permissions('ai.agent.run')
  @ApiOkResponse({ type: WorkflowPlanResponseDto })
  async getOne(@Param('id', ParseUUIDPipe) id: string) {
    const plan = await this.plans.getOne(id);
    if (!plan) throw new NotFoundException(`Workflow plan "${id}" not found`);
    return plan;
  }

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  @Permissions('ai.agent.run')
  @ApiOperation({
    summary: 'Generate deterministic plans and submit them to the existing approval framework',
  })
  @ApiOkResponse({ type: WorkflowPlansResponseDto })
  generate(@Body() _dto: GenerateWorkflowPlansDto, @CurrentUser() user: CurrentUserInterface) {
    return this.plans.generate(user.permissions);
  }

  @Post('generate/stream')
  @HttpCode(HttpStatus.OK)
  @Permissions('ai.agent.run')
  @ApiOperation({ summary: 'Stream plan generation progress over the shared SSE transport' })
  @ApiConsumes('application/json')
  @ApiProduces('text/event-stream')
  async generateStream(
    @Body() dto: GenerateWorkflowPlansDto,
    @CurrentUser() user: CurrentUserInterface,
    @Res() response: Response,
  ): Promise<void> {
    await writeGatewayEventStreamToResponse(response, (signal) =>
      this.plans.stream(user.permissions, dto.objective ?? 'Generate workflow plans.', signal),
    );
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @Permissions('ai.agent.run')
  @ApiOperation({ summary: 'Submit a plan to the existing approval framework (idempotent)' })
  @ApiOkResponse({ type: WorkflowPlanResponseDto })
  submit(@Param('id', ParseUUIDPipe) id: string) {
    return this.approvals.submit(id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @Permissions('ai.agent.run')
  @ApiOkResponse({ type: WorkflowPlanResponseDto })
  cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.approvals.cancel(id);
  }

  /**
   * Hands an approved plan to the existing workflow module. Requires
   * `ai.approval.decide` on top of `ai.agent.run`: starting approved work
   * is a stronger act than asking for a plan.
   */
  @Post(':id/handoff')
  @HttpCode(HttpStatus.OK)
  @Permissions('ai.agent.run', 'ai.approval.decide')
  @ApiOperation({ summary: 'Hand an approved plan to the existing workflow module' })
  @ApiOkResponse({ type: WorkflowPlanHandoffResponseDto })
  handOff(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: HandOffWorkflowPlanDto,
    @CurrentUser() user: CurrentUserInterface,
  ) {
    return this.handoff.handOff(id, user.permissions, dto.planVersion);
  }
}
