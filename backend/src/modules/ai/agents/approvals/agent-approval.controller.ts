import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AUTH_GUARDS } from '../../../../common/guards/protected.guards';
import { CurrentUser } from '../../../auth/decorators/current-user.decorator';
import { CurrentUser as CurrentUserInterface } from '../../../auth/interfaces/current-user.interface';
import { Permissions } from '../../../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../../../permissions/guards/permission.guard';
import { AgentApprovalService } from '../../approvals/agent-approval.service';
import { AgentApprovalDecisionService } from './agent-approval-decision.service';
import {
  AgentApprovalResponseDto,
  AgentApprovalSuccessResponseDto,
  DecideAgentApprovalDto,
  ListPendingApprovalsQueryDto,
  PaginatedAgentApprovalsSuccessResponseDto,
} from './dto/agent-approval.dto';

@ApiTags('AI')
@ApiBearerAuth('JWT')
@Controller('ai/approvals')
export class AgentApprovalController {
  constructor(
    private readonly agentApprovalService: AgentApprovalService,
    private readonly agentApprovalDecisionService: AgentApprovalDecisionService,
  ) {}

  @Get()
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('ai.approval.read')
  @ApiOperation({ summary: 'List pending AI tool-call approvals awaiting a human decision' })
  @ApiOkResponse({ type: PaginatedAgentApprovalsSuccessResponseDto })
  async listPending(@Query() query: ListPendingApprovalsQueryDto) {
    const result = await this.agentApprovalService.listPending(query.page ?? 1, query.limit ?? 20);
    return {
      ...result,
      items: result.items.map((item) => AgentApprovalResponseDto.fromEntity(item)),
    };
  }

  @Post(':id/decide')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('ai.approval.decide')
  @ApiOperation({ summary: 'Approve or reject a pending AI tool-call approval' })
  @ApiOkResponse({ type: AgentApprovalSuccessResponseDto })
  async decide(
    @Param('id') id: string,
    @Body() dto: DecideAgentApprovalDto,
    @CurrentUser() user: CurrentUserInterface,
  ): Promise<AgentApprovalResponseDto> {
    const decided = await this.agentApprovalDecisionService.decide(
      id,
      dto.decision,
      user.id,
      dto.comment,
    );
    return AgentApprovalResponseDto.fromEntity(decided);
  }
}
