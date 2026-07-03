import { Module } from '@nestjs/common';
import { RoleRepository } from './role.repository';
import { RoleService } from './role.service';
import { RolesController } from './roles.controller';

@Module({
  controllers: [RolesController],
  providers: [RoleRepository, RoleService],
  exports: [RoleRepository, RoleService],
})
export class RolesModule {}
