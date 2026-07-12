import { Module } from '@nestjs/common';
import { PlatformAdminGuard } from '../../../common/guards/platform-admin.guard';
import { UsersModule } from '../../users/users.module';
import { PlatformUserController } from './platform-user.controller';
import { PlatformUserService } from './platform-user.service';

@Module({
  imports: [UsersModule],
  controllers: [PlatformUserController],
  providers: [PlatformUserService, PlatformAdminGuard],
})
export class PlatformUserModule {}
