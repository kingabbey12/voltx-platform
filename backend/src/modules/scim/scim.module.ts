import { Module } from '@nestjs/common';
import { RolesModule } from '../roles/roles.module';
import { UsersModule } from '../users/users.module';
import { ScimDiscoveryController } from './scim-discovery.controller';
import { ScimGroupsController, ScimUsersController } from './scim.controller';
import { ScimGroupsService } from './scim-groups.service';
import { ScimProvisionJobRepository } from './scim-provision-job.repository';
import { ScimTokenController } from './scim-token.controller';
import { ScimTokenRepository } from './scim-token.repository';
import { ScimTokenService } from './scim-token.service';
import { ScimUsersService } from './scim-users.service';
import { ScimTokenGuard } from './guards/scim-token.guard';

@Module({
  imports: [UsersModule, RolesModule],
  controllers: [
    ScimTokenController,
    ScimUsersController,
    ScimGroupsController,
    ScimDiscoveryController,
  ],
  providers: [
    ScimTokenRepository,
    ScimTokenService,
    ScimProvisionJobRepository,
    ScimUsersService,
    ScimGroupsService,
    ScimTokenGuard,
  ],
  exports: [ScimTokenRepository],
})
export class ScimModule {}
