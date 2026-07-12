import { Injectable, NotFoundException } from '@nestjs/common';
import { FeatureFlagType, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { FeatureFlagEntity, toFeatureFlagEntity } from './entities/feature-flag.entity';

export interface CreateFeatureFlagData {
  key: string;
  name: string;
  description?: string;
  type: FeatureFlagType;
  defaultValue: unknown;
}

export interface UpdateFeatureFlagData {
  name?: string;
  description?: string;
  defaultValue?: unknown;
}

@Injectable()
export class FeatureFlagRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateFeatureFlagData): Promise<FeatureFlagEntity> {
    const record = await this.prisma.system.featureFlag.create({
      data: {
        key: data.key,
        name: data.name,
        description: data.description,
        type: data.type,
        defaultValue: data.defaultValue as Prisma.InputJsonValue,
      },
    });
    return toFeatureFlagEntity(record);
  }

  async findAll(): Promise<FeatureFlagEntity[]> {
    const records = await this.prisma.system.featureFlag.findMany({ orderBy: { key: 'asc' } });
    return records.map(toFeatureFlagEntity);
  }

  async findByKey(key: string): Promise<FeatureFlagEntity | null> {
    const record = await this.prisma.system.featureFlag.findUnique({ where: { key } });
    return record ? toFeatureFlagEntity(record) : null;
  }

  async update(key: string, data: UpdateFeatureFlagData): Promise<FeatureFlagEntity> {
    const record = await this.prisma.system.featureFlag.update({
      where: { key },
      data: {
        name: data.name,
        description: data.description,
        ...(data.defaultValue !== undefined
          ? { defaultValue: data.defaultValue as Prisma.InputJsonValue }
          : {}),
      },
    });
    return toFeatureFlagEntity(record);
  }

  async delete(key: string): Promise<void> {
    await this.prisma.system.featureFlag.delete({ where: { key } });
  }

  /**
   * Read-modify-write on the organizationOverrides Json blob — acceptable
   * for an admin-console write path with low concurrency; there is no
   * atomic Json-merge primitive in Prisma to do this in one statement.
   */
  async setOverride(
    key: string,
    organizationId: string,
    value: unknown,
  ): Promise<FeatureFlagEntity> {
    const existing = await this.prisma.system.featureFlag.findUnique({ where: { key } });
    if (!existing) {
      throw new NotFoundException('Feature flag not found');
    }
    const overrides = { ...(existing.organizationOverrides as Record<string, unknown>) };
    overrides[organizationId] = value;

    const record = await this.prisma.system.featureFlag.update({
      where: { key },
      data: { organizationOverrides: overrides as Prisma.InputJsonValue },
    });
    return toFeatureFlagEntity(record);
  }

  async removeOverride(key: string, organizationId: string): Promise<FeatureFlagEntity> {
    const existing = await this.prisma.system.featureFlag.findUnique({ where: { key } });
    if (!existing) {
      throw new NotFoundException('Feature flag not found');
    }
    const overrides = { ...(existing.organizationOverrides as Record<string, unknown>) };
    delete overrides[organizationId];

    const record = await this.prisma.system.featureFlag.update({
      where: { key },
      data: { organizationOverrides: overrides as Prisma.InputJsonValue },
    });
    return toFeatureFlagEntity(record);
  }
}
