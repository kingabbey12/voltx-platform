import { Module } from '@nestjs/common';
import { PlatformAdminGuard } from '../../../common/guards/platform-admin.guard';
import { FeatureFlagModule } from '../feature-flags/feature-flag.module';
import { UsersModule } from '../../users/users.module';
import { PlatformMaintenanceModeController } from './platform-maintenance-mode.controller';
import { PlatformMaintenanceModeService } from './platform-maintenance-mode.service';

@Module({
  imports: [UsersModule, FeatureFlagModule],
  controllers: [PlatformMaintenanceModeController],
  providers: [PlatformMaintenanceModeService, PlatformAdminGuard],
})
export class PlatformMaintenanceModeModule {}
