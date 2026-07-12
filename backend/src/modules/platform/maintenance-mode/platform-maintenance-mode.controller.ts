import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';
import { PLATFORM_ADMIN_GUARDS } from '../../../common/guards/protected.guards';
import {
  MaintenanceModeStatus,
  PlatformMaintenanceModeService,
} from './platform-maintenance-mode.service';

export class SetMaintenanceModeDto {
  @IsBoolean()
  enabled!: boolean;
}

@ApiTags('Platform Admin — Maintenance Mode')
@ApiBearerAuth('JWT')
@UseGuards(...PLATFORM_ADMIN_GUARDS)
@Controller('platform/maintenance-mode')
export class PlatformMaintenanceModeController {
  constructor(private readonly service: PlatformMaintenanceModeService) {}

  @Get()
  @ApiOperation({ summary: 'Platform admin: current maintenance-mode status' })
  getStatus(): Promise<MaintenanceModeStatus> {
    return this.service.getStatus();
  }

  @Put()
  @ApiOperation({ summary: 'Platform admin: enable or disable maintenance mode' })
  setStatus(@Body() dto: SetMaintenanceModeDto): Promise<MaintenanceModeStatus> {
    return this.service.setEnabled(dto.enabled);
  }
}
