import { Global, Module } from '@nestjs/common';
import { PermissionGuard } from './guards/permission.guard';
import { PermissionRepository } from './permission.repository';
import { PermissionService } from './permission.service';
import { PermissionsController } from './permissions.controller';

@Global()
@Module({
  controllers: [PermissionsController],
  providers: [PermissionRepository, PermissionService, PermissionGuard],
  exports: [PermissionRepository, PermissionService, PermissionGuard],
})
export class PermissionsModule {}
