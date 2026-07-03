import { Injectable } from '@nestjs/common';
import { PermissionResponseDto } from './dto/permission-response.dto';
import { PermissionRepository } from './permission.repository';

@Injectable()
export class PermissionService {
  constructor(private readonly permissionRepository: PermissionRepository) {}

  async findAll(): Promise<PermissionResponseDto[]> {
    const permissions = await this.permissionRepository.findAll();
    return permissions.map((permission) => PermissionResponseDto.fromEntity(permission));
  }

  async getPermissionKeysForRole(roleId: string): Promise<string[]> {
    return this.permissionRepository.findPermissionKeysByRoleId(roleId);
  }
}
