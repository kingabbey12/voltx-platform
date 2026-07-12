import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PLATFORM_ADMIN_GUARDS } from '../../../common/guards/protected.guards';
import {
  OrganizationHierarchyResult,
  OrganizationSummary,
  PlatformReportingService,
} from './platform-reporting.service';

@ApiTags('Platform Admin — Reporting')
@ApiBearerAuth('JWT')
@UseGuards(...PLATFORM_ADMIN_GUARDS)
@Controller('platform')
export class PlatformReportingController {
  constructor(private readonly platformReportingService: PlatformReportingService) {}

  @Get('organizations/:id/hierarchy')
  @ApiOperation({ summary: "Platform admin: view an organization's parent and subsidiaries" })
  async getOrganizationHierarchy(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<OrganizationHierarchyResult> {
    return this.platformReportingService.getOrganizationHierarchy(id);
  }

  @Get('reporting/cross-org')
  @ApiOperation({
    summary:
      'Platform admin: cross-organization reporting — every top-level org by default, or a full subtree when rootOrganizationId is given',
  })
  async getCrossOrgReport(
    @Query('rootOrganizationId') rootOrganizationId?: string,
  ): Promise<OrganizationSummary[]> {
    return this.platformReportingService.getCrossOrgReport(rootOrganizationId);
  }
}
