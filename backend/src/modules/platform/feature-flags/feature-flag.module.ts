import { Module } from '@nestjs/common';
import { PlatformAdminGuard } from '../../../common/guards/platform-admin.guard';
import { UsersModule } from '../../users/users.module';
import { FeatureFlagController } from './feature-flag.controller';
import { FeatureFlagRepository } from './feature-flag.repository';
import { FeatureFlagService } from './feature-flag.service';

@Module({
  imports: [UsersModule],
  controllers: [FeatureFlagController],
  providers: [FeatureFlagRepository, FeatureFlagService, PlatformAdminGuard],
  exports: [FeatureFlagService],
})
export class FeatureFlagModule {}
