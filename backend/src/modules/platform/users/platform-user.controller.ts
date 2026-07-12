import { Controller, Get, Param, ParseUUIDPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PLATFORM_ADMIN_GUARDS } from '../../../common/guards/protected.guards';
import {
  ListPlatformUsersQueryDto,
  PaginatedPlatformUsersDto,
  PlatformUserDetailDto,
} from './dto/platform-user.dto';
import { PlatformUserService } from './platform-user.service';

@ApiTags('Platform Admin — Users')
@ApiBearerAuth('JWT')
@UseGuards(...PLATFORM_ADMIN_GUARDS)
@Controller('platform/users')
export class PlatformUserController {
  constructor(private readonly service: PlatformUserService) {}

  @Get()
  @ApiOperation({ summary: 'Platform admin: search users across the entire platform' })
  search(@Query() query: ListPlatformUsersQueryDto): Promise<PaginatedPlatformUsersDto> {
    return this.service.search(query);
  }

  @Get(':id')
  @ApiOperation({
    summary: "Platform admin: get a user's detail, including every organization membership",
  })
  getDetail(@Param('id', ParseUUIDPipe) id: string): Promise<PlatformUserDetailDto> {
    return this.service.getDetail(id);
  }
}
