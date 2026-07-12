import { Module } from '@nestjs/common';
import { PlatformAdminGuard } from '../../../common/guards/platform-admin.guard';
import { UsersModule } from '../../users/users.module';
import { PlatformOrgHealthController } from './platform-org-health.controller';
import { PlatformOrgHealthService } from './platform-org-health.service';

@Module({
  imports: [UsersModule],
  controllers: [PlatformOrgHealthController],
  providers: [PlatformOrgHealthService, PlatformAdminGuard],
})
export class PlatformOrgHealthModule {}
