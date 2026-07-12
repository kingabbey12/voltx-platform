import { Injectable, NotFoundException } from '@nestjs/common';
import { FeatureFlagType } from '@prisma/client';
import { FeatureFlagService } from '../feature-flags/feature-flag.service';

export const MAINTENANCE_MODE_FLAG_KEY = 'platform.maintenance_mode';

export interface MaintenanceModeStatus {
  enabled: boolean;
}

/**
 * Maintenance mode is stored AS a FeatureFlag (key
 * 'platform.maintenance_mode') rather than a new model — Phase 7 already
 * built a platform-wide typed-flag store with exactly this shape
 * (BOOLEAN, no per-org override needed here), so this service is a thin,
 * typed wrapper over FeatureFlagService rather than a parallel storage
 * mechanism.
 */
@Injectable()
export class PlatformMaintenanceModeService {
  constructor(private readonly featureFlagService: FeatureFlagService) {}

  async getStatus(): Promise<MaintenanceModeStatus> {
    const flag = await this.findFlag();
    return { enabled: flag ? Boolean(flag.defaultValue) : false };
  }

  async setEnabled(enabled: boolean): Promise<MaintenanceModeStatus> {
    const flag = await this.findFlag();
    if (!flag) {
      await this.featureFlagService.create({
        key: MAINTENANCE_MODE_FLAG_KEY,
        name: 'Platform Maintenance Mode',
        description: 'When enabled, the API can reject non-essential traffic with a clear message.',
        type: FeatureFlagType.BOOLEAN,
        defaultValue: enabled,
      });
    } else {
      await this.featureFlagService.update(MAINTENANCE_MODE_FLAG_KEY, { defaultValue: enabled });
    }
    return { enabled };
  }

  private async findFlag() {
    try {
      return await this.featureFlagService.getOrThrow(MAINTENANCE_MODE_FLAG_KEY);
    } catch (error) {
      if (error instanceof NotFoundException) {
        return null;
      }
      throw error;
    }
  }
}
