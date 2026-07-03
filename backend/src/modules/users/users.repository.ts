import { Injectable } from '@nestjs/common';
import { Prisma, UserStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { UserEntity } from './entities/user.entity';
import { toUserEntity } from './entities/user.mapper';

export interface CreateUserData {
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  phoneNumber?: string;
  jobTitle?: string;
  status?: UserStatus;
  lastLoginAt?: Date;
  emailVerifiedAt?: Date;
}

export interface UpdateUserData {
  firstName?: string;
  lastName?: string;
  avatarUrl?: string | null;
  phoneNumber?: string | null;
  jobTitle?: string | null;
  status?: UserStatus;
  lastLoginAt?: Date | null;
  emailVerifiedAt?: Date | null;
}

export interface FindAllUsersParams {
  page: number;
  limit: number;
  status?: UserStatus;
  search?: string;
}

export interface PaginatedUsers {
  items: UserEntity[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class UsersRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateUserData): Promise<UserEntity> {
    const record = await this.prisma.user.create({
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

  async findByEmail(email: string): Promise<UserEntity | null> {
    const record = await this.prisma.user.findFirst({
      where: { email: email.toLowerCase(), deletedAt: null },
    });

    return record ? toUserEntity(record) : null;
  }

  async findAll(params: FindAllUsersParams): Promise<PaginatedUsers> {
    const { page, limit, status, search } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(status ? { status } : {}),
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' } },
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [records, total] = await this.prisma.$transaction([
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

  async update(id: string, data: UpdateUserData): Promise<UserEntity | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }

    const updateData: Prisma.UserUpdateInput = {};

    if (data.firstName !== undefined) {
      updateData.firstName = data.firstName;
    }
    if (data.lastName !== undefined) {
      updateData.lastName = data.lastName;
    }
    if (data.avatarUrl !== undefined) {
      updateData.avatarUrl = data.avatarUrl;
    }
    if (data.phoneNumber !== undefined) {
      updateData.phoneNumber = data.phoneNumber;
    }
    if (data.jobTitle !== undefined) {
      updateData.jobTitle = data.jobTitle;
    }
    if (data.status !== undefined) {
      updateData.status = data.status;
    }
    if (data.lastLoginAt !== undefined) {
      updateData.lastLoginAt = data.lastLoginAt;
    }
    if (data.emailVerifiedAt !== undefined) {
      updateData.emailVerifiedAt = data.emailVerifiedAt;
    }

    const record = await this.prisma.user.update({
      where: { id },
      data: updateData,
    });

    return toUserEntity(record);
  }

  async softDelete(id: string): Promise<UserEntity | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }

    const record = await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return toUserEntity(record);
  }
}
