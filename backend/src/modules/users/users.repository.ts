import { Injectable } from '@nestjs/common';
import { MembershipStatus, UserStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { UserEntity } from './entities/user.entity';
import { toUserEntity } from './entities/user.mapper';

export interface CreateUserData {
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  phoneNumber?: string;
  jobTitle?: string;
  status?: import('@prisma/client').UserStatus;
  lastLoginAt?: Date;
  emailVerifiedAt?: Date;
}

export interface UpdateUserData {
  firstName?: string;
  lastName?: string;
  avatarUrl?: string | null;
  phoneNumber?: string | null;
  jobTitle?: string | null;
  status?: import('@prisma/client').UserStatus;
  lastLoginAt?: Date | null;
  emailVerifiedAt?: Date | null;
}

export interface FindAllUsersParams {
  page: number;
  limit: number;
  status?: import('@prisma/client').UserStatus;
  search?: string;
}

export interface PaginatedUsers {
  items: UserEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function buildUserSearchWhere(status?: UserStatus, search?: string) {
  return {
    deletedAt: null,
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' as const } },
            { firstName: { contains: search, mode: 'insensitive' as const } },
            { lastName: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}),
  };
}

@Injectable()
export class UsersRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async create(data: CreateUserData): Promise<UserEntity> {
    const record = await this.prisma.system.user.create({
      data: {
        email: data.email.toLowerCase(),
        firstName: data.firstName,
        lastName: data.lastName,
        avatarUrl: data.avatarUrl,
        phoneNumber: data.phoneNumber,
        jobTitle: data.jobTitle,
        status: data.status ?? UserStatus.ACTIVE,
        lastLoginAt: data.lastLoginAt,
        emailVerifiedAt: data.emailVerifiedAt,
      },
    });

    return toUserEntity(record);
  }

  async findById(id: string): Promise<UserEntity | null> {
    const record = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });

    return record ? toUserEntity(record) : null;
  }

  /**
   * Unscoped by design — used by PlatformAdminGuard, which must resolve
   * the caller's own user row (to check isPlatformAdmin) independent of
   * whatever organization their JWT's tenant context happens to carry.
   */
  async findByIdUnscoped(id: string): Promise<UserEntity | null> {
    const record = await this.prisma.system.user.findFirst({
      where: { id, deletedAt: null },
    });

    return record ? toUserEntity(record) : null;
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const record = await this.prisma.system.user.findFirst({
      where: { email: email.toLowerCase(), deletedAt: null },
    });

    return record ? toUserEntity(record) : null;
  }

  async existsInAnotherTenant(userId: string): Promise<boolean> {
    const tenant = this.tenantContextService.getOrThrow();
    const membership = await this.prisma.system.membership.findFirst({
      where: {
        userId,
        status: MembershipStatus.ACTIVE,
        organizationId: { not: tenant.organizationId },
      },
      select: { id: true },
    });

    return membership !== null;
  }

  async findAll(params: FindAllUsersParams): Promise<PaginatedUsers> {
    const { page, limit, status, search } = params;
    const skip = (page - 1) * limit;
    const where = buildUserSearchWhere(status, search);

    const [records, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: records.map(toUserEntity),
      total,
      page,
      limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    };
  }

  /**
   * Platform-admin cross-organization user search — queries
   * `this.prisma.system.user` (unscoped), not `this.prisma.user` (which
   * findAll above uses): the tenant-scoping Prisma extension otherwise
   * narrows user queries to members of the calling admin's own
   * organization only, which is wrong for "search every user on the
   * platform." Used only behind PLATFORM_ADMIN_GUARDS
   * (src/modules/platform/users/).
   */
  async searchUnscoped(params: FindAllUsersParams): Promise<PaginatedUsers> {
    const { page, limit, status, search } = params;
    const skip = (page - 1) * limit;
    const where = buildUserSearchWhere(status, search);

    const [records, total] = await Promise.all([
      this.prisma.system.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.system.user.count({ where }),
    ]);

    return {
      items: records.map(toUserEntity),
      total,
      page,
      limit,
      totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    };
  }

  async update(id: string, data: UpdateUserData): Promise<UserEntity | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }

    const record = await this.prisma.system.user.update({
      where: { id },
      data,
    });

    return toUserEntity(record);
  }

  /**
   * Self-healing setter used by AuthService.login() to grant/reflect
   * cross-organization Super Admin Billing Console access from the
   * PLATFORM_ADMIN_EMAILS env allowlist — unscoped, since this must work
   * regardless of which organization the login's tenant context resolves to.
   */
  async setPlatformAdmin(id: string, isPlatformAdmin: boolean): Promise<UserEntity> {
    const record = await this.prisma.system.user.update({
      where: { id },
      data: { isPlatformAdmin },
    });
    return toUserEntity(record);
  }

  async softDelete(id: string): Promise<UserEntity | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }

    const record = await this.prisma.system.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return toUserEntity(record);
  }
}
