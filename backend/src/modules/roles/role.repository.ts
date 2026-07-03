import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { RoleEntity } from './entities/role.entity';
import { toRoleEntity, toRoleEntityWithoutPermissions } from './entities/role.mapper';

@Injectable()
export class RoleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<RoleEntity[]> {
    const records = await this.prisma.role.findMany({
      include: {
        rolePermissions: {
          include: { permission: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return records.map(toRoleEntity);
  }

  async findById(id: string): Promise<RoleEntity | null> {
    const record = await this.prisma.role.findUnique({
      where: { id },
      include: {
        rolePermissions: {
          include: { permission: true },
        },
      },
    });

    return record ? toRoleEntity(record) : null;
  }

  async findByKey(key: string): Promise<RoleEntity | null> {
    const record = await this.prisma.role.findUnique({
      where: { key },
      include: {
        rolePermissions: {
          include: { permission: true },
        },
      },
    });

    return record ? toRoleEntity(record) : null;
  }

  async findByKeyOrThrow(key: string): Promise<RoleEntity> {
    const role = await this.findByKey(key);
    if (!role) {
      throw new Error(`Role with key "${key}" not found`);
    }
    return role;
  }

  async findBasicByKey(key: string): Promise<RoleEntity | null> {
    const record = await this.prisma.role.findUnique({ where: { key } });
    return record ? toRoleEntityWithoutPermissions(record) : null;
  }
}
