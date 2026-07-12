import { Module } from '@nestjs/common';
import { PlatformAdminGuard } from '../../../common/guards/platform-admin.guard';
import { UsersModule } from '../../users/users.module';
import { PlatformAlertController } from './platform-alert.controller';
import { PlatformAlertRepository } from './platform-alert.repository';
import { PlatformAlertService } from './platform-alert.service';

@Module({
  imports: [UsersModule],
  controllers: [PlatformAlertController],
  providers: [PlatformAlertRepository, PlatformAlertService, PlatformAdminGuard],
  exports: [PlatformAlertService],
})
export class PlatformAlertModule {}
