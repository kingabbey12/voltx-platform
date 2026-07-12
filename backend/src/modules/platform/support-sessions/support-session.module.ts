import { Module } from '@nestjs/common';
import { PlatformAdminGuard } from '../../../common/guards/platform-admin.guard';
import { RolesModule } from '../../roles/roles.module';
import { UsersModule } from '../../users/users.module';
import { SupportSessionController } from './support-session.controller';
import { SupportSessionService } from './support-session.service';

@Module({
  imports: [UsersModule, RolesModule],
  controllers: [SupportSessionController],
  providers: [SupportSessionService, PlatformAdminGuard],
})
export class SupportSessionModule {}
