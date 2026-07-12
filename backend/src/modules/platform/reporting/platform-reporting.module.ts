import { Module } from '@nestjs/common';
import { PlatformAdminGuard } from '../../../common/guards/platform-admin.guard';
import { UsersModule } from '../../users/users.module';
import { PlatformReportingController } from './platform-reporting.controller';
import { PlatformReportingService } from './platform-reporting.service';

@Module({
  imports: [UsersModule],
  controllers: [PlatformReportingController],
  providers: [PlatformReportingService, PlatformAdminGuard],
})
export class PlatformReportingModule {}
