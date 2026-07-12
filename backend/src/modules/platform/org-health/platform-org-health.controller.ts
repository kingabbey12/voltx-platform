import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PLATFORM_ADMIN_GUARDS } from '../../../common/guards/protected.guards';
import { OrgDiagnosticsDto, OrgHealthScoreDto } from './dto/org-health.dto';
import { PlatformOrgHealthService } from './platform-org-health.service';

@ApiTags('Platform Admin — Customer Success')
@ApiBearerAuth('JWT')
@UseGuards(...PLATFORM_ADMIN_GUARDS)
@Controller('platform/organizations/:organizationId')
export class PlatformOrgHealthController {
  constructor(private readonly service: PlatformOrgHealthService) {}

  @Get('health-score')
  @ApiOperation({ summary: "Platform admin: an organization's computed customer health score" })
  getHealthScore(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ): Promise<OrgHealthScoreDto> {
    return this.service.getHealthScore(organizationId);
  }

  @Get('diagnostics')
  @ApiOperation({ summary: 'Platform admin: raw diagnostic signals for one organization' })
  getDiagnostics(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ): Promise<OrgDiagnosticsDto> {
    return this.service.getDiagnostics(organizationId);
  }
}
