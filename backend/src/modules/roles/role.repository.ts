import { Injectable } from '@nestjs/common';
import { MembershipStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { RoleEntity } from './entities/role.entity';
import { toRoleEntity, toRoleEntityWithoutPermissions } from './entities/role.mapper';

export interface CreateRoleData {
  key: string;
  name: string;
  description?: string;
  organizationId: string;
  permissionIds: string[];
}

export interface UpdateRoleData {
  name?: string;
  description?: string;
  permissionIds?: string[];
}

const ROLE_INCLUDE = {
  rolePermissions: {
    include: { permission: true },
  },
} as const;

@Injectable()
export class RoleRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** System roles (organizationId null, shared by every organization) plus
   * this organization's own custom roles — never another organization's
   * custom roles. Role is not one of the models the tenant Prisma
   * extension auto-scopes (see CLAUDE.md), so this filter is applied
   * explicitly here rather than relying on that defense-in-depth layer. */
  async findAllForOrganization(organizationId: string): Promise<RoleEntity[]> {
    const records = await this.prisma.role.findMany({
      where: { OR: [{ organizationId: null }, { organizationId }] },
      include: ROLE_INCLUDE,
      orderBy: { name: 'asc' },
    });

    return records.map(toRoleEntity);
  }

  async findByIdForOrganization(id: string, organizationId: string): Promise<RoleEntity | null> {
    const record = await this.prisma.role.findFirst({
      where: { id, OR: [{ organizationId: null }, { organizationId }] },
      include: ROLE_INCLUDE,
    });

    return record ? toRoleEntity(record) : null;
  }

  async findById(id: string): Promise<RoleEntity | null> {
    const record = await this.prisma.role.findUnique({
      where: { id },
      include: ROLE_INCLUDE,
    });

    return record ? toRoleEntity(record) : null;
  }

  async findByKey(key: string): Promise<RoleEntity | null> {
    const record = await this.prisma.role.findUnique({
      where: { key },
      include: ROLE_INCLUDE,
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

  async isKeyTaken(key: string): Promise<boolean> {
    const record = await this.prisma.role.findUnique({ where: { key }, select: { id: true } });
    return record !== null;
  }

  async create(data: CreateRoleData): Promise<RoleEntity> {
    const record = await this.prisma.role.create({
      data: {
        key: data.key,
        name: data.name,
        description: data.description,
        organizationId: data.organizationId,
        isSystem: false,
        rolePermissions: {
          create: data.permissionIds.map((permissionId) => ({ permissionId })),
        },
      },
      include: ROLE_INCLUDE,
    });

    return toRoleEntity(record);
  }

  /** Replaces the role's entire permission set when `permissionIds` is
   * provided (delete-then-recreate, in a transaction) rather than diffing
   * — simpler and the set is small (well under a hundred rows). */
  async update(id: string, data: UpdateRoleData): Promise<RoleEntity> {
    const record = await this.prisma.runInTransaction(async (tx) => {
      if (data.permissionIds) {
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
      }

      return tx.role.update({
        where: { id },
        data: {
          name: data.name,
          description: data.description,
          ...(data.permissionIds
            ? {
                rolePermissions: {
                  create: data.permissionIds.map((permissionId) => ({ permissionId })),
                },
              }
            : {}),
        },
        include: ROLE_INCLUDE,
      });
    });

    return toRoleEntity(record);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.role.delete({ where: { id } });
  }

  async countActiveMembershipsForRole(id: string): Promise<number> {
    return this.prisma.membership.count({
      where: { roleId: id, status: MembershipStatus.ACTIVE },
    });
  }
}
