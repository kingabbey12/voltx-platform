import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { PermissionRepository } from '../permissions/permission.repository';
import { CreateRoleDto } from './dto/create-role.dto';
import { RoleListResponseDto, RoleResponseDto } from './dto/role-response.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { RoleRepository } from './role.repository';
import { generateUniqueRoleKey } from './utils/role-key.util';

@Injectable()
export class RoleService {
  constructor(
    private readonly roleRepository: RoleRepository,
    private readonly permissionRepository: PermissionRepository,
    private readonly auditService: AuditService,
  ) {}

  async findAll(organizationId: string): Promise<RoleListResponseDto> {
    const roles = await this.roleRepository.findAllForOrganization(organizationId);
    return {
      items: roles.map((role) => RoleResponseDto.fromEntity(role)),
    };
  }

  async findOne(id: string, organizationId: string): Promise<RoleResponseDto> {
    const role = await this.roleRepository.findByIdForOrganization(id, organizationId);
    if (!role) {
      throw new NotFoundException(`Role with id "${id}" not found`);
    }

    return RoleResponseDto.fromEntity(role);
  }

  async findByKey(key: string): Promise<RoleResponseDto> {
    const role = await this.roleRepository.findByKey(key);
    if (!role) {
      throw new NotFoundException(`Role with key "${key}" not found`);
    }

    return RoleResponseDto.fromEntity(role);
  }

  async create(organizationId: string, dto: CreateRoleDto): Promise<RoleResponseDto> {
    const permissionIds = await this.resolvePermissionIdsOrThrow(dto.permissionKeys);
    const key = await generateUniqueRoleKey(dto.name, (candidate) =>
      this.roleRepository.isKeyTaken(candidate),
    );

    const role = await this.roleRepository.create({
      key,
      name: dto.name,
      description: dto.description,
      organizationId,
      permissionIds,
    });

    await this.auditService.record({
      action: 'role.created',
      resource: 'role',
      resourceId: role.id,
      metadata: { name: role.name, permissionKeys: role.permissionKeys },
    });

    return RoleResponseDto.fromEntity(role);
  }

  async update(id: string, organizationId: string, dto: UpdateRoleDto): Promise<RoleResponseDto> {
    const existing = await this.getMutableCustomRoleOrThrow(id, organizationId);

    const permissionIds = dto.permissionKeys
      ? await this.resolvePermissionIdsOrThrow(dto.permissionKeys)
      : undefined;

    const role = await this.roleRepository.update(existing.id, {
      name: dto.name,
      description: dto.description,
      permissionIds,
    });

    await this.auditService.record({
      action: 'role.updated',
      resource: 'role',
      resourceId: role.id,
      metadata: { name: role.name, permissionKeys: role.permissionKeys },
    });

    return RoleResponseDto.fromEntity(role);
  }

  async delete(id: string, organizationId: string): Promise<void> {
    const existing = await this.getMutableCustomRoleOrThrow(id, organizationId);

    const activeMemberships = await this.roleRepository.countActiveMembershipsForRole(existing.id);
    if (activeMemberships > 0) {
      throw new ConflictException(
        `Cannot delete role "${existing.name}" — ${activeMemberships} member(s) still have it assigned. Reassign them first.`,
      );
    }

    await this.roleRepository.delete(existing.id);

    await this.auditService.record({
      action: 'role.deleted',
      resource: 'role',
      resourceId: existing.id,
      metadata: { name: existing.name },
    });
  }

  /** Loads a role and enforces the two invariants every mutation (update
   * and delete) shares: it must belong to the caller's own organization
   * (never another org's custom role, never reachable at all for a
   * not-found id), and it must not be a system role — those are seeded,
   * shared across every organization, and relied on by name elsewhere in
   * the codebase (e.g. auth.service.ts's register() looks up the 'owner'
   * role key directly), so they're immutable via this API regardless of
   * the caller's own permissions. */
  private async getMutableCustomRoleOrThrow(id: string, organizationId: string) {
    const role = await this.roleRepository.findByIdForOrganization(id, organizationId);
    if (!role) {
      throw new NotFoundException(`Role with id "${id}" not found`);
    }
    if (role.isSystem || role.organizationId !== organizationId) {
      throw new ForbiddenException('System roles cannot be modified or deleted');
    }
    return role;
  }

  private async resolvePermissionIdsOrThrow(permissionKeys: string[]): Promise<string[]> {
    const catalog = await this.permissionRepository.findAll();
    const catalogByKey = new Map(catalog.map((permission) => [permission.key, permission.id]));

    const uniqueKeys = Array.from(new Set(permissionKeys));
    const unknownKeys = uniqueKeys.filter((key) => !catalogByKey.has(key));
    if (unknownKeys.length > 0) {
      throw new BadRequestException(`Unknown permission key(s): ${unknownKeys.join(', ')}`);
    }

    return uniqueKeys.map((key) => catalogByKey.get(key)!);
  }
}
