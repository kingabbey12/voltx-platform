import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { MembershipStatus, ScimOperationType, ScimProvisionJobStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { RoleRepository } from '../roles/role.repository';
import { ScimProvisionJobRepository } from './scim-provision-job.repository';
import {
  SCIM_GROUP_SCHEMA,
  ScimGroupResource,
  ScimListResponse,
  ScimPatchOpRequest,
} from './dto/scim-wire.types';

/**
 * Voltx RBAC assigns exactly one Role per Membership (no multi-group
 * membership model) — SCIM Groups are therefore projected onto Roles:
 * each Role is one Group, and a Group's "members" are the organization's
 * active memberships holding that role. Adding a member to a Group
 * assigns that role; removing falls back to the "member" role. This is a
 * deliberate simplification of SCIM's group model to fit Voltx's
 * single-role-per-user RBAC, not a full multi-group system.
 */
@Injectable()
export class ScimGroupsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roleRepository: RoleRepository,
    private readonly scimProvisionJobRepository: ScimProvisionJobRepository,
  ) {}

  async list(organizationId: string): Promise<ScimListResponse<ScimGroupResource>> {
    const roles = await this.roleRepository.findAll();
    const resources = await Promise.all(
      roles.map((role) =>
        this.toScimGroupResource(
          organizationId,
          role.id,
          role.name,
          role.createdAt,
          role.updatedAt,
        ),
      ),
    );

    return {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: resources.length,
      startIndex: 1,
      itemsPerPage: resources.length,
      Resources: resources,
    };
  }

  async getById(organizationId: string, roleId: string): Promise<ScimGroupResource> {
    const role = await this.roleRepository.findById(roleId);
    if (!role) {
      throw new NotFoundException('SCIM group not found');
    }
    return this.toScimGroupResource(
      organizationId,
      role.id,
      role.name,
      role.createdAt,
      role.updatedAt,
    );
  }

  async patch(
    organizationId: string,
    scimTokenId: string,
    roleId: string,
    patchRequest: ScimPatchOpRequest,
  ): Promise<ScimGroupResource> {
    const role = await this.roleRepository.findById(roleId);
    if (!role) {
      throw new NotFoundException('SCIM group not found');
    }
    const fallbackRole = await this.roleRepository.findByKeyOrThrow('member');

    for (const operation of patchRequest.Operations ?? []) {
      const members = extractMemberIds(operation.value);
      if (operation.op === 'add' && (operation.path === 'members' || !operation.path)) {
        for (const userId of members) {
          await this.assignRoleIfMember(organizationId, userId, role.id);
        }
      } else if (operation.op === 'remove' && (operation.path?.startsWith('members') ?? false)) {
        const targeted = members.length > 0 ? members : extractValueFromPath(operation.path);
        for (const userId of targeted) {
          await this.assignRoleIfMember(organizationId, userId, fallbackRole.id);
        }
      }
    }

    await this.scimProvisionJobRepository.record({
      organizationId,
      scimTokenId,
      operation: ScimOperationType.GROUP_SYNC,
      status: ScimProvisionJobStatus.SUCCESS,
      requestPayload: patchRequest,
    });

    return this.toScimGroupResource(
      organizationId,
      role.id,
      role.name,
      role.createdAt,
      role.updatedAt,
    );
  }

  private async assignRoleIfMember(
    organizationId: string,
    userId: string,
    roleId: string,
  ): Promise<void> {
    const membership = await this.prisma.system.membership.findFirst({
      where: { organizationId, userId, status: MembershipStatus.ACTIVE },
    });
    if (!membership) {
      throw new BadRequestException(`User ${userId} is not an active member of this organization`);
    }
    await this.prisma.system.membership.update({ where: { id: membership.id }, data: { roleId } });
  }

  private async toScimGroupResource(
    organizationId: string,
    roleId: string,
    roleName: string,
    createdAt: Date,
    updatedAt: Date,
  ): Promise<ScimGroupResource> {
    const memberships = await this.prisma.system.membership.findMany({
      where: { organizationId, roleId, status: MembershipStatus.ACTIVE },
      include: { user: true },
    });

    return {
      schemas: [SCIM_GROUP_SCHEMA],
      id: roleId,
      displayName: roleName,
      members: memberships.map((m) => ({ value: m.userId, display: m.user.email })),
      meta: {
        resourceType: 'Group',
        created: createdAt.toISOString(),
        lastModified: updatedAt.toISOString(),
      },
    };
  }
}

function extractMemberIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => (isRecord(entry) && typeof entry.value === 'string' ? entry.value : undefined))
    .filter((v): v is string => Boolean(v));
}

/** `remove` ops sometimes encode the target in the path itself, e.g. `members[value eq "user-id"]`. */
function extractValueFromPath(path: string | undefined): string[] {
  if (!path) return [];
  const match = /value eq "([^"]+)"/.exec(path);
  return match ? [match[1]] : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
