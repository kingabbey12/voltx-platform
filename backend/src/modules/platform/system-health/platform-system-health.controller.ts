import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PLATFORM_ADMIN_GUARDS } from '../../../common/guards/protected.guards';
import {
  PlatformSystemHealthResult,
  PlatformSystemHealthService,
} from './platform-system-health.service';

@ApiTags('Platform Admin — System Health')
@ApiBearerAuth('JWT')
@UseGuards(...PLATFORM_ADMIN_GUARDS)
@Controller('platform/system-health')
export class PlatformSystemHealthController {
  constructor(private readonly service: PlatformSystemHealthService) {}

  @Get()
  @ApiOperation({
    summary:
      'Platform admin: aggregated system health — database/Redis status, queue backlogs, recent job failures, and comms delivery failure rate',
  })
  get(): Promise<PlatformSystemHealthResult> {
    return this.service.getSystemHealth();
  }
}
