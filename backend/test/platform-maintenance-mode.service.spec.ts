import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { FeatureFlagService } from '../src/modules/platform/feature-flags/feature-flag.service';
import {
  MAINTENANCE_MODE_FLAG_KEY,
  PlatformMaintenanceModeService,
} from '../src/modules/platform/maintenance-mode/platform-maintenance-mode.service';

describe('PlatformMaintenanceModeService', () => {
  let service: PlatformMaintenanceModeService;
  let featureFlagService: jest.Mocked<FeatureFlagService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformMaintenanceModeService,
        {
          provide: FeatureFlagService,
          useValue: { getOrThrow: jest.fn(), create: jest.fn(), update: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(PlatformMaintenanceModeService);
    featureFlagService = module.get(FeatureFlagService);
  });

  it('reports disabled when the flag has never been created', async () => {
    featureFlagService.getOrThrow.mockRejectedValue(new NotFoundException());

    const status = await service.getStatus();

    expect(status).toEqual({ enabled: false });
  });

  it("reflects the flag's current defaultValue when it exists", async () => {
    featureFlagService.getOrThrow.mockResolvedValue({ defaultValue: true } as never);

    const status = await service.getStatus();

    expect(status).toEqual({ enabled: true });
  });

  it('creates the flag the first time maintenance mode is enabled', async () => {
    featureFlagService.getOrThrow.mockRejectedValue(new NotFoundException());

    const result = await service.setEnabled(true);

    expect(featureFlagService.create).toHaveBeenCalledWith(
      expect.objectContaining({ key: MAINTENANCE_MODE_FLAG_KEY, defaultValue: true }),
    );
    expect(featureFlagService.update).not.toHaveBeenCalled();
    expect(result).toEqual({ enabled: true });
  });

  it('updates the existing flag on subsequent toggles', async () => {
    featureFlagService.getOrThrow.mockResolvedValue({ defaultValue: true } as never);

    const result = await service.setEnabled(false);

    expect(featureFlagService.update).toHaveBeenCalledWith(MAINTENANCE_MODE_FLAG_KEY, {
      defaultValue: false,
    });
    expect(featureFlagService.create).not.toHaveBeenCalled();
    expect(result).toEqual({ enabled: false });
  });
});
