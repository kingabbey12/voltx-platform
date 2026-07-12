import { Controller, Get, Param, ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PLATFORM_ADMIN_GUARDS } from '../../../common/guards/protected.guards';
import {
  PlatformOrganizationRevenueDto,
  PlatformRevenueSummaryDto,
} from './dto/platform-revenue.dto';
import { PlatformRevenueService } from './platform-revenue.service';

@ApiTags('Platform Admin — Revenue')
@ApiBearerAuth('JWT')
@UseGuards(...PLATFORM_ADMIN_GUARDS)
@Controller('platform/revenue')
export class PlatformRevenueController {
  constructor(private readonly service: PlatformRevenueService) {}

  @Get('summary')
  @ApiOperation({ summary: 'Platform admin: platform-wide revenue and subscription summary' })
  getSummary(): Promise<PlatformRevenueSummaryDto> {
    return this.service.getSummary();
  }

  @Get('organizations/:organizationId')
  @ApiOperation({ summary: "Platform admin: a single organization's revenue detail" })
  getOrganizationRevenue(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ): Promise<PlatformOrganizationRevenueDto> {
    return this.service.getOrganizationRevenue(organizationId);
  }
}
