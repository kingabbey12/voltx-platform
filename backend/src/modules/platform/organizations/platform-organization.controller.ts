import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PLATFORM_ADMIN_GUARDS } from '../../../common/guards/protected.guards';
import {
  ListPlatformOrganizationsQueryDto,
  PaginatedPlatformOrganizationsDto,
  PlatformOrganizationDetailDto,
} from './dto/platform-organization.dto';
import { PlatformOrganizationService } from './platform-organization.service';

@ApiTags('Platform Admin — Organizations')
@ApiBearerAuth('JWT')
@UseGuards(...PLATFORM_ADMIN_GUARDS)
@Controller('platform/organizations')
export class PlatformOrganizationController {
  constructor(private readonly service: PlatformOrganizationService) {}

  @Get()
  @ApiOperation({ summary: 'Platform admin: search organizations across the entire platform' })
  search(
    @Query() query: ListPlatformOrganizationsQueryDto,
  ): Promise<PaginatedPlatformOrganizationsDto> {
    return this.service.search(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Platform admin: get organization detail by id' })
  getDetail(@Param('id', ParseUUIDPipe) id: string): Promise<PlatformOrganizationDetailDto> {
    return this.service.getDetail(id);
  }
}
