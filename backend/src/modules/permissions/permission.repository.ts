import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PermissionEntity } from './entities/permission.entity';
import { toPermissionEntity } from './entities/permission.mapper';

@Injectable()
export class PermissionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<PermissionEntity[]> {
    const records = await this.prisma.permission.findMany({
      orderBy: [{ resource: 'asc' }, { action: 'asc' }],
    });

    return records.map(toPermissionEntity);
  }

  async findByKey(key: string): Promise<PermissionEntity | null> {
    const record = await this.prisma.permission.findUnique({ where: { key } });
    return record ? toPermissionEntity(record) : null;
  }

  async findPermissionKeysByRoleId(roleId: string): Promise<string[]> {
    const records = await this.prisma.rolePermission.findMany({
      where: { roleId },
      include: { permission: true },
      orderBy: { permission: { key: 'asc' } },
    });

    return records.map((record) => record.permission.key);
  }
}
