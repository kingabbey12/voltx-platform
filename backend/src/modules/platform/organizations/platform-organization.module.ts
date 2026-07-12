import { Module } from '@nestjs/common';
import { PlatformAdminGuard } from '../../../common/guards/platform-admin.guard';
import { OrganizationModule } from '../../organization/organization.module';
import { UsersModule } from '../../users/users.module';
import { PlatformOrganizationController } from './platform-organization.controller';
import { PlatformOrganizationService } from './platform-organization.service';

@Module({
  imports: [OrganizationModule, UsersModule],
  controllers: [PlatformOrganizationController],
  providers: [PlatformOrganizationService, PlatformAdminGuard],
})
export class PlatformOrganizationModule {}
