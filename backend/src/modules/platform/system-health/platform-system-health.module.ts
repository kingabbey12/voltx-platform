import { Module } from '@nestjs/common';
import { PlatformAdminGuard } from '../../../common/guards/platform-admin.guard';
import { HealthModule } from '../../health/health.module';
import { UsersModule } from '../../users/users.module';
import { PlatformSystemHealthController } from './platform-system-health.controller';
import { PlatformSystemHealthService } from './platform-system-health.service';

@Module({
  imports: [HealthModule, UsersModule],
  controllers: [PlatformSystemHealthController],
  providers: [PlatformSystemHealthService, PlatformAdminGuard],
})
export class PlatformSystemHealthModule {}
