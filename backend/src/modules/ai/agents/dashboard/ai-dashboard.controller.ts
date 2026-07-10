import { Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AUTH_GUARDS } from '../../../../common/guards/protected.guards';
import { Permissions } from '../../../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../../../permissions/guards/permission.guard';
import { AiDashboardService } from './ai-dashboard.service';
import {
  AiPerformanceSuccessResponseDto,
  AiSuggestionResponseDto,
  AiSuggestionsSuccessResponseDto,
  AiTasksSuccessResponseDto,
  ListActivityQueryDto,
  PaginatedActivitySuccessResponseDto,
  PerformanceQueryDto,
} from './dto/ai-dashboard.dto';

@ApiTags('AI')
@ApiBearerAuth('JWT')
@Controller('ai/dashboard')
export class AiDashboardController {
  constructor(private readonly aiDashboardService: AiDashboardService) {}

  @Get('activity')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('ai.agent.read')
  @ApiOperation({ summary: 'Recent AI agent run activity across the organization' })
  @ApiOkResponse({ type: PaginatedActivitySuccessResponseDto })
  async getActivity(@Query() query: ListActivityQueryDto) {
    return this.aiDashboardService.getActivity(query.page ?? 1, query.limit ?? 20);
  }

  @Get('performance')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('ai.agent.read')
  @ApiOperation({ summary: 'AI usage/cost performance summary, overall and per agent' })
  @ApiOkResponse({ type: AiPerformanceSuccessResponseDto })
  async getPerformance(@Query() query: PerformanceQueryDto) {
    return this.aiDashboardService.getPerformance(query.lookbackDays ?? 30);
  }

  @Get('tasks')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('ai.approval.read')
  @ApiOperation({ summary: 'Pending approvals and in-progress agent runs needing attention' })
  @ApiOkResponse({ type: AiTasksSuccessResponseDto })
  async getTasks() {
    return this.aiDashboardService.getTasks();
  }

  @Get('suggestions')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('ai.agent.read')
  @ApiOperation({ summary: 'Proactive AI-generated suggestions for the organization' })
  @ApiOkResponse({ type: AiSuggestionsSuccessResponseDto })
  async getSuggestions(): Promise<AiSuggestionResponseDto[]> {
    const suggestions = await this.aiDashboardService.getSuggestions();
    return suggestions.map((suggestion) => AiSuggestionResponseDto.fromEntity(suggestion));
  }

  @Patch('suggestions/:id/dismiss')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('ai.agent.read')
  @ApiOperation({ summary: 'Dismiss a suggestion' })
  @ApiOkResponse()
  async dismissSuggestion(@Param('id') id: string): Promise<{ dismissed: boolean }> {
    await this.aiDashboardService.dismissSuggestion(id);
    return { dismissed: true };
  }
}
