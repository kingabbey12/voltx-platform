import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MembershipStatus,
  Prisma,
  ScimOperationType,
  ScimProvisionJobStatus,
  User,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { RefreshTokenRepository } from '../auth/refresh-token.repository';
import { RoleRepository } from '../roles/role.repository';
import { UserEntity } from '../users/entities/user.entity';
import { UsersRepository } from '../users/users.repository';
import { ScimProvisionJobRepository } from './scim-provision-job.repository';
import {
  SCIM_USER_SCHEMA,
  ScimListResponse,
  ScimPatchOpRequest,
  ScimUserResource,
} from './dto/scim-wire.types';
import { parseScimEqFilter } from './utils/scim-filter.util';

interface MembershipRow {
  id: string;
  status: MembershipStatus;
}

@Injectable()
export class ScimUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersRepository: UsersRepository,
    private readonly roleRepository: RoleRepository,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly scimProvisionJobRepository: ScimProvisionJobRepository,
  ) {}

  async list(
    organizationId: string,
    scimTokenId: string,
    params: { filter?: string; startIndex: number; count: number },
  ): Promise<ScimListResponse<ScimUserResource>> {
    const parsedFilter = parseScimEqFilter(params.filter);

    const memberships = await this.prisma.system.membership.findMany({
      where: {
        organizationId,
        ...(parsedFilter && ['username', 'email'].includes(parsedFilter.attribute)
          ? { user: { email: parsedFilter.value.toLowerCase() } }
          : {}),
      },
      include: { user: true },
      orderBy: { joinedAt: 'asc' },
      skip: Math.max(params.startIndex - 1, 0),
      take: params.count,
    });

    const total = await this.prisma.system.membership.count({
      where: {
        organizationId,
        ...(parsedFilter && ['username', 'email'].includes(parsedFilter.attribute)
          ? { user: { email: parsedFilter.value.toLowerCase() } }
          : {}),
      },
    });

    return {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: total,
      startIndex: params.startIndex,
      itemsPerPage: memberships.length,
      Resources: memberships.map((m) => this.toScimUserResource(m.user, m)),
    };
  }

  async getById(organizationId: string, userId: string): Promise<ScimUserResource> {
    const membership = await this.findMembershipOrThrow(organizationId, userId);
    return this.toScimUserResource(membership.user, membership);
  }

  async create(
    organizationId: string,
    scimTokenId: string,
    payload: Record<string, unknown>,
  ): Promise<ScimUserResource> {
    const email = requireString(payload.userName, 'userName').toLowerCase();
    const name = (payload.name ?? {}) as { givenName?: string; familyName?: string };
    const externalId = typeof payload.externalId === 'string' ? payload.externalId : undefined;
    const active = payload.active !== false;

    try {
      const existingUser = await this.usersRepository.findByEmail(email);

      let user: UserEntity | User;
      let membershipId: string;
      if (existingUser) {
        const existingMembership = await this.prisma.system.membership.findFirst({
          where: { organizationId, userId: existingUser.id },
        });
        if (existingMembership && existingMembership.status === MembershipStatus.ACTIVE) {
          throw new ConflictException(
            'A user with this email is already provisioned in this organization',
          );
        }
        const role = await this.roleRepository.findByKeyOrThrow('member');
        if (existingMembership) {
          await this.prisma.system.membership.update({
            where: { id: existingMembership.id },
            data: { status: active ? MembershipStatus.ACTIVE : MembershipStatus.INACTIVE },
          });
          membershipId = existingMembership.id;
        } else {
          const created = await this.prisma.system.membership.create({
            data: {
              organizationId,
              userId: existingUser.id,
              roleId: role.id,
              status: active ? MembershipStatus.ACTIVE : MembershipStatus.INACTIVE,
            },
          });
          membershipId = created.id;
        }
        user = existingUser;
      } else {
        const role = await this.roleRepository.findByKeyOrThrow('member');
        const result = await this.prisma.system.$transaction(async (tx) => {
          const createdUser = await tx.user.create({
            data: {
              email,
              firstName: name.givenName?.trim() || email.split('@')[0],
              lastName: name.familyName?.trim() || '—',
              status: 'ACTIVE',
              emailVerifiedAt: new Date(),
            },
          });
          const createdMembership = await tx.membership.create({
            data: {
              organizationId,
              userId: createdUser.id,
              roleId: role.id,
              status: active ? MembershipStatus.ACTIVE : MembershipStatus.INACTIVE,
            },
          });
          return { user: createdUser, membershipId: createdMembership.id };
        });
        user = result.user;
        membershipId = result.membershipId;
      }

      await this.recordJob(organizationId, scimTokenId, ScimOperationType.CREATE_USER, {
        externalId,
        targetUserId: user.id,
        targetMembershipId: membershipId,
        status: ScimProvisionJobStatus.SUCCESS,
        requestPayload: payload,
      });

      return this.toScimUserResource(user, {
        id: membershipId,
        status: active ? MembershipStatus.ACTIVE : MembershipStatus.INACTIVE,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A user with this email already exists');
      }
      await this.recordJob(organizationId, scimTokenId, ScimOperationType.CREATE_USER, {
        externalId,
        status: ScimProvisionJobStatus.FAILED,
        requestPayload: payload,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  async replace(
    organizationId: string,
    scimTokenId: string,
    userId: string,
    payload: Record<string, unknown>,
  ): Promise<ScimUserResource> {
    const membership = await this.findMembershipOrThrow(organizationId, userId);
    const name = (payload.name ?? {}) as { givenName?: string; familyName?: string };
    const active = payload.active !== false;

    const updatedUser = await this.usersRepository.update(userId, {
      firstName: name.givenName?.trim() || membership.user.firstName,
      lastName: name.familyName?.trim() || membership.user.lastName,
    });

    await this.setMembershipActive(organizationId, membership.id, membership.userId, active);

    await this.recordJob(organizationId, scimTokenId, ScimOperationType.UPDATE_USER, {
      targetUserId: userId,
      targetMembershipId: membership.id,
      status: ScimProvisionJobStatus.SUCCESS,
      requestPayload: payload,
    });

    return this.toScimUserResource(updatedUser ?? membership.user, {
      id: membership.id,
      status: active ? MembershipStatus.ACTIVE : MembershipStatus.INACTIVE,
    });
  }

  async patch(
    organizationId: string,
    scimTokenId: string,
    userId: string,
    patchRequest: ScimPatchOpRequest,
  ): Promise<ScimUserResource> {
    const membership = await this.findMembershipOrThrow(organizationId, userId);
    let nextActive = membership.status === MembershipStatus.ACTIVE;
    let nextFirstName: string | undefined;
    let nextLastName: string | undefined;

    for (const operation of patchRequest.Operations ?? []) {
      if (operation.op !== 'replace' && operation.op !== 'add') {
        continue;
      }
      if (operation.path === 'active') {
        nextActive = operation.value === true;
      } else if (!operation.path && isRecord(operation.value) && 'active' in operation.value) {
        nextActive = operation.value.active === true;
      } else if (operation.path === 'name.givenName') {
        nextFirstName = String(operation.value);
      } else if (operation.path === 'name.familyName') {
        nextLastName = String(operation.value);
      }
    }

    if (nextFirstName || nextLastName) {
      await this.usersRepository.update(userId, {
        firstName: nextFirstName ?? membership.user.firstName,
        lastName: nextLastName ?? membership.user.lastName,
      });
    }

    const operationType =
      nextActive === false ? ScimOperationType.DEACTIVATE_USER : ScimOperationType.UPDATE_USER;
    await this.setMembershipActive(organizationId, membership.id, membership.userId, nextActive);

    await this.recordJob(organizationId, scimTokenId, operationType, {
      targetUserId: userId,
      targetMembershipId: membership.id,
      status: ScimProvisionJobStatus.SUCCESS,
      requestPayload: patchRequest,
    });

    const refreshedUser = await this.usersRepository.findById(userId);
    return this.toScimUserResource(refreshedUser ?? membership.user, {
      id: membership.id,
      status: nextActive ? MembershipStatus.ACTIVE : MembershipStatus.INACTIVE,
    });
  }

  /** SCIM DELETE deactivates the organization membership — it never deletes the shared User row (a Voltx user can belong to other organizations). */
  async remove(organizationId: string, scimTokenId: string, userId: string): Promise<void> {
    const membership = await this.findMembershipOrThrow(organizationId, userId);
    await this.setMembershipActive(organizationId, membership.id, membership.userId, false);

    await this.recordJob(organizationId, scimTokenId, ScimOperationType.DEACTIVATE_USER, {
      targetUserId: userId,
      targetMembershipId: membership.id,
      status: ScimProvisionJobStatus.SUCCESS,
      requestPayload: { action: 'delete' },
    });
  }

  /**
   * Deactivating a membership must never leave a valid session behind —
   * revokes every refresh token for the user immediately. (Phase 4's
   * Session model, once merged, should extend this same call site to also
   * revoke live sessions; this is the correct integration point.)
   */
  private async setMembershipActive(
    organizationId: string,
    membershipId: string,
    userId: string,
    active: boolean,
  ): Promise<void> {
    await this.prisma.system.membership.update({
      where: { id: membershipId },
      data: { status: active ? MembershipStatus.ACTIVE : MembershipStatus.INACTIVE },
    });
    if (!active) {
      await this.refreshTokenRepository.revokeAllByUserId(userId);
    }
  }

  private async findMembershipOrThrow(
    organizationId: string,
    userId: string,
  ): Promise<MembershipRow & { userId: string; user: User }> {
    const membership = await this.prisma.system.membership.findFirst({
      where: { organizationId, userId },
      include: { user: true },
    });
    if (!membership) {
      throw new NotFoundException('SCIM user not found');
    }
    return membership;
  }

  private toScimUserResource(
    user: Pick<User, 'id' | 'email' | 'firstName' | 'lastName' | 'createdAt' | 'updatedAt'>,
    membership: MembershipRow,
  ): ScimUserResource {
    return {
      schemas: [SCIM_USER_SCHEMA],
      id: user.id,
      userName: user.email,
      name: { givenName: user.firstName, familyName: user.lastName },
      emails: [{ value: user.email, primary: true }],
      active: membership.status === MembershipStatus.ACTIVE,
      meta: {
        resourceType: 'User',
        created: user.createdAt.toISOString(),
        lastModified: user.updatedAt.toISOString(),
      },
    };
  }

  private async recordJob(
    organizationId: string,
    scimTokenId: string,
    operation: ScimOperationType,
    data: {
      externalId?: string;
      targetUserId?: string;
      targetMembershipId?: string;
      status: ScimProvisionJobStatus;
      requestPayload: unknown;
      errorMessage?: string;
    },
  ): Promise<void> {
    await this.scimProvisionJobRepository.record({
      organizationId,
      scimTokenId,
      operation,
      ...data,
    });
  }
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new BadRequestException(`${field} is required`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
