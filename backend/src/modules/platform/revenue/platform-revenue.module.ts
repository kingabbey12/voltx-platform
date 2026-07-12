import { Module } from '@nestjs/common';
import { PlatformAdminGuard } from '../../../common/guards/platform-admin.guard';
import { UsersModule } from '../../users/users.module';
import { PlatformRevenueController } from './platform-revenue.controller';
import { PlatformRevenueService } from './platform-revenue.service';

@Module({
  imports: [UsersModule],
  controllers: [PlatformRevenueController],
  providers: [PlatformRevenueService, PlatformAdminGuard],
})
export class PlatformRevenueModule {}
