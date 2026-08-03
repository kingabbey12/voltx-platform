import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AUTH_GUARDS } from '../../../common/guards/protected.guards';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { CurrentUser as CurrentUserInterface } from '../../auth/interfaces/current-user.interface';
import { Permissions } from '../../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../../permissions/guards/permission.guard';
import { ExecutiveInsightsResponseDto } from './insights.dto';
import { ExecutiveInsightsService } from './insights.service';

@ApiTags('AI Executive Insights')
@ApiBearerAuth('JWT')
@UseGuards(...AUTH_GUARDS, PermissionGuard)
@Controller('ai/insights')
export class ExecutiveInsightsController {
  constructor(private readonly insights: ExecutiveInsightsService) {}
  @Get()
  @Permissions('ai.agent.run')
  @ApiOkResponse({ type: ExecutiveInsightsResponseDto })
  getInsights(@CurrentUser() user: CurrentUserInterface) {
    return this.insights.generate(user.permissions);
  }
}
