import { Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AUTH_GUARDS } from '../../../common/guards/protected.guards';
import { Permissions } from '../../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../../permissions/guards/permission.guard';
import { DashboardRecommendationActionService } from './dashboard-recommendation-action.service';
import { RecommendationActionResultDto } from './dto/dashboard-recommendation.dto';
import { DashboardRecommendationService } from './dashboard-recommendation.service';
import { RecommendationView } from './dashboard-recommendation.types';

@ApiTags('Dashboard Recommendations')
@ApiBearerAuth('JWT')
@Controller('dashboard/recommendations')
@UseGuards(...AUTH_GUARDS)
export class DashboardRecommendationsController {
  constructor(
    private readonly recommendations: DashboardRecommendationService,
    private readonly actions: DashboardRecommendationActionService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List active evidence-backed recommendations for the current organization',
  })
  list(): Promise<RecommendationView[]> {
    return this.recommendations.getRecommendations();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get recommendation evidence and proposed actions' })
  get(@Param('id', ParseUUIDPipe) id: string): Promise<RecommendationView> {
    return this.recommendations.getRecommendation(id);
  }

  @Post(':id/approve')
  @UseGuards(PermissionGuard)
  @Permissions('sales.activity.create')
  @ApiOperation({ summary: 'Approve a recommendation before executing its action' })
  approve(@Param('id', ParseUUIDPipe) id: string): Promise<RecommendationView> {
    return this.actions.approve(id);
  }

  @Post(':id/dismiss')
  @ApiOperation({ summary: 'Dismiss a recommendation for the current organization' })
  async dismiss(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.actions.dismiss(id);
  }

  @Post(':id/actions/:actionId/execute')
  @UseGuards(PermissionGuard)
  @Permissions('sales.activity.create')
  @ApiOperation({ summary: 'Execute an approved recommendation action exactly once' })
  @ApiOkResponse({ type: RecommendationActionResultDto })
  execute(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('actionId', ParseUUIDPipe) actionId: string,
  ): Promise<RecommendationActionResultDto> {
    return this.actions.execute(id, actionId);
  }
}
