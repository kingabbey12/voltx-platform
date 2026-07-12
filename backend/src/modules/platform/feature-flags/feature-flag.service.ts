import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FeatureFlagType, Prisma } from '@prisma/client';
import { FeatureFlagEntity } from './entities/feature-flag.entity';
import {
  CreateFeatureFlagData,
  FeatureFlagRepository,
  UpdateFeatureFlagData,
} from './feature-flag.repository';

export interface ResolvedFeatureFlag {
  key: string;
  value: unknown;
  source: 'override' | 'default';
}

@Injectable()
export class FeatureFlagService {
  constructor(private readonly repository: FeatureFlagRepository) {}

  async create(data: CreateFeatureFlagData): Promise<FeatureFlagEntity> {
    assertValueMatchesType(data.type, data.defaultValue, 'defaultValue');
    try {
      return await this.repository.create(data);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(`A feature flag with key "${data.key}" already exists`);
      }
      throw error;
    }
  }

  list(): Promise<FeatureFlagEntity[]> {
    return this.repository.findAll();
  }

  async getOrThrow(key: string): Promise<FeatureFlagEntity> {
    const flag = await this.repository.findByKey(key);
    if (!flag) {
      throw new NotFoundException('Feature flag not found');
    }
    return flag;
  }

  async update(key: string, data: UpdateFeatureFlagData): Promise<FeatureFlagEntity> {
    const flag = await this.getOrThrow(key);
    if (data.defaultValue !== undefined) {
      assertValueMatchesType(flag.type, data.defaultValue, 'defaultValue');
    }
    return this.repository.update(key, data);
  }

  async delete(key: string): Promise<void> {
    await this.getOrThrow(key);
    await this.repository.delete(key);
  }

  async setOverride(
    key: string,
    organizationId: string,
    value: unknown,
  ): Promise<FeatureFlagEntity> {
    const flag = await this.getOrThrow(key);
    assertValueMatchesType(flag.type, value, 'value');
    return this.repository.setOverride(key, organizationId, value);
  }

  async removeOverride(key: string, organizationId: string): Promise<FeatureFlagEntity> {
    await this.getOrThrow(key);
    return this.repository.removeOverride(key, organizationId);
  }

  /**
   * Resolution order: an organization-specific override always wins over
   * the flag's platform-wide default. Exported for other modules to
   * consume directly (no HTTP round-trip) once they need to gate a code
   * path on a flag.
   */
  async resolve(key: string, organizationId: string): Promise<ResolvedFeatureFlag> {
    const flag = await this.getOrThrow(key);
    if (Object.prototype.hasOwnProperty.call(flag.organizationOverrides, organizationId)) {
      return { key, value: flag.organizationOverrides[organizationId], source: 'override' };
    }
    return { key, value: flag.defaultValue, source: 'default' };
  }
}

function assertValueMatchesType(type: FeatureFlagType, value: unknown, fieldName: string): void {
  switch (type) {
    case FeatureFlagType.BOOLEAN:
      if (typeof value !== 'boolean') {
        throw new BadRequestException(`${fieldName} must be a boolean for a BOOLEAN feature flag`);
      }
      return;
    case FeatureFlagType.STRING:
      if (typeof value !== 'string') {
        throw new BadRequestException(`${fieldName} must be a string for a STRING feature flag`);
      }
      return;
    case FeatureFlagType.NUMBER:
      if (typeof value !== 'number' || Number.isNaN(value)) {
        throw new BadRequestException(`${fieldName} must be a number for a NUMBER feature flag`);
      }
      return;
    case FeatureFlagType.JSON:
      if (value === undefined) {
        throw new BadRequestException(`${fieldName} must be provided for a JSON feature flag`);
      }
      return;
  }
}
