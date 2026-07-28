import { Controller, DefaultValuePipe, Get, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AUTH_GUARDS } from '../../common/guards/protected.guards';
import { DashboardService, type ExecutiveSnapshot } from './dashboard.service';

@ApiTags('Dashboard')
@ApiBearerAuth('JWT')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  /**
   * One call, one executive picture.
   *
   * No `@Permissions` guard: this returns aggregate counts for the caller's own
   * organization and nothing a member cannot already reach through the CRM
   * pages. Gating it behind a sales permission would hide the dashboard from
   * people who are entitled to see their own workspace's shape.
   */
  @Get('metrics')
  @UseGuards(...AUTH_GUARDS)
  @ApiOperation({
    summary: 'Executive snapshot: current totals, historical trends and changes',
    description:
      'Aggregated in SQL and served in a single request. Trend series come from ' +
      'daily snapshots, so a new workspace returns empty arrays until the ' +
      'aggregation job has run at least twice.',
  })
  @ApiQuery({
    name: 'days',
    required: false,
    description: 'Days of history to include (1–365, default 30).',
  })
  @ApiOkResponse({ description: 'Executive snapshot for the current organization' })
  getMetrics(
    @Query('days', new DefaultValuePipe(30), ParseIntPipe) days: number,
  ): Promise<ExecutiveSnapshot> {
    // Clamped rather than validated-and-rejected: a nonsense window is not
    // worth failing a dashboard load over, and an unbounded value would let a
    // caller ask for an arbitrarily large scan.
    const window = Math.min(Math.max(days, 1), 365);
    return this.dashboardService.getExecutiveSnapshot(window);
  }
}
