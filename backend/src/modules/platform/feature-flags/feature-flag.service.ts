import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FeatureFlagType, Prisma } from '@prisma/client';
import { CACHE_SERVICE, CacheService } from '../../cache/cache.service';
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

const RESOLVE_CACHE_TTL_MS = 60 * 1000;

function resolveCacheKey(key: string, organizationId: string): string {
  return `feature-flag:resolve:${key}:${organizationId}`;
}

function flagTag(key: string): string {
  return `feature-flag:${key}`;
}

@Injectable()
export class FeatureFlagService {
  constructor(
    private readonly repository: FeatureFlagRepository,
    @Inject(CACHE_SERVICE) private readonly cacheService: CacheService,
  ) {}

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
    const updated = await this.repository.update(key, data);
    await this.cacheService.invalidateTag(flagTag(key));
    return updated;
  }

  async delete(key: string): Promise<void> {
    await this.getOrThrow(key);
    await this.repository.delete(key);
    await this.cacheService.invalidateTag(flagTag(key));
  }

  async setOverride(
    key: string,
    organizationId: string,
    value: unknown,
  ): Promise<FeatureFlagEntity> {
    const flag = await this.getOrThrow(key);
    assertValueMatchesType(flag.type, value, 'value');
    const updated = await this.repository.setOverride(key, organizationId, value);
    await this.cacheService.invalidateTag(flagTag(key));
    return updated;
  }

  async removeOverride(key: string, organizationId: string): Promise<FeatureFlagEntity> {
    await this.getOrThrow(key);
    const updated = await this.repository.removeOverride(key, organizationId);
    await this.cacheService.invalidateTag(flagTag(key));
    return updated;
  }

  /**
   * Resolution order: an organization-specific override always wins over
   * the flag's platform-wide default. Exported for other modules to
   * consume directly (no HTTP round-trip) once they need to gate a code
   * path on a flag. Cached briefly (v2.2 Platform Scale) since this is
   * meant to be called on hot request paths once other modules start
   * gating behavior on flags; every write path above invalidates the
   * `feature-flag:<key>` tag so a change is visible within one TTL window
   * at worst, never permanently stale.
   */
  async resolve(key: string, organizationId: string): Promise<ResolvedFeatureFlag> {
    const cacheKey = resolveCacheKey(key, organizationId);
    const cached = await this.cacheService.get<ResolvedFeatureFlag>(cacheKey);
    if (cached) {
      return cached;
    }

    const flag = await this.getOrThrow(key);
    const result: ResolvedFeatureFlag = Object.prototype.hasOwnProperty.call(
      flag.organizationOverrides,
      organizationId,
    )
      ? { key, value: flag.organizationOverrides[organizationId], source: 'override' }
      : { key, value: flag.defaultValue, source: 'default' };

    await this.cacheService.set(cacheKey, result, RESOLVE_CACHE_TTL_MS, [flagTag(key)]);
    return result;
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
