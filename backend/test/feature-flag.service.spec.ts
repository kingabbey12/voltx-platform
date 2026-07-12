import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { CACHE_SERVICE, CacheService } from '../src/modules/cache/cache.service';
import { FeatureFlagEntity } from '../src/modules/platform/feature-flags/entities/feature-flag.entity';
import { FeatureFlagRepository } from '../src/modules/platform/feature-flags/feature-flag.repository';
import { FeatureFlagService } from '../src/modules/platform/feature-flags/feature-flag.service';

function makeFlag(overrides: Partial<FeatureFlagEntity> = {}): FeatureFlagEntity {
  return {
    id: 'flag-1',
    key: 'new-dashboard',
    name: 'New Dashboard',
    description: null,
    type: 'BOOLEAN',
    defaultValue: false,
    organizationOverrides: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('FeatureFlagService', () => {
  let service: FeatureFlagService;
  let repository: jest.Mocked<FeatureFlagRepository>;
  let cacheService: jest.Mocked<CacheService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureFlagService,
        {
          provide: FeatureFlagRepository,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findByKey: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            setOverride: jest.fn(),
            removeOverride: jest.fn(),
          },
        },
        {
          provide: CACHE_SERVICE,
          useValue: {
            get: jest.fn().mockResolvedValue(null),
            set: jest.fn(),
            invalidateTag: jest.fn(),
            invalidateKey: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(FeatureFlagService);
    repository = module.get(FeatureFlagRepository);
    cacheService = module.get(CACHE_SERVICE);
  });

  it('creates a BOOLEAN flag with a valid default value', async () => {
    repository.create.mockResolvedValue(makeFlag());
    const result = await service.create({
      key: 'new-dashboard',
      name: 'New Dashboard',
      type: 'BOOLEAN',
      defaultValue: false,
    });
    expect(result.key).toBe('new-dashboard');
  });

  it('rejects a BOOLEAN flag with a non-boolean default value', async () => {
    await expect(
      service.create({ key: 'bad', name: 'Bad', type: 'BOOLEAN', defaultValue: 'not-a-bool' }),
    ).rejects.toThrow(BadRequestException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('rejects a NUMBER flag with a string default value', async () => {
    await expect(
      service.create({ key: 'bad', name: 'Bad', type: 'NUMBER', defaultValue: 'ten' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('accepts a STRING flag with a string default value', async () => {
    repository.create.mockResolvedValue(makeFlag({ type: 'STRING', defaultValue: 'blue' }));
    const result = await service.create({
      key: 'theme-color',
      name: 'Theme Color',
      type: 'STRING',
      defaultValue: 'blue',
    });
    expect(result.defaultValue).toBe('blue');
  });

  it('converts a P2002 unique-constraint error into ConflictException', async () => {
    repository.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('duplicate', {
        code: 'P2002',
        clientVersion: '6.0.0',
      }),
    );
    await expect(
      service.create({ key: 'new-dashboard', name: 'Dup', type: 'BOOLEAN', defaultValue: true }),
    ).rejects.toThrow(ConflictException);
  });

  it('throws NotFoundException for an unknown flag key', async () => {
    repository.findByKey.mockResolvedValue(null);
    await expect(service.getOrThrow('not-real')).rejects.toThrow(NotFoundException);
  });

  it('rejects setting an override whose value does not match the flag type', async () => {
    repository.findByKey.mockResolvedValue(makeFlag({ type: 'NUMBER', defaultValue: 10 }));
    await expect(service.setOverride('new-dashboard', 'org-1', 'not-a-number')).rejects.toThrow(
      BadRequestException,
    );
    expect(repository.setOverride).not.toHaveBeenCalled();
  });

  it('resolution order: an organization override wins over the platform default', async () => {
    repository.findByKey.mockResolvedValue(
      makeFlag({ defaultValue: false, organizationOverrides: { 'org-1': true } }),
    );

    const overridden = await service.resolve('new-dashboard', 'org-1');
    expect(overridden).toEqual({ key: 'new-dashboard', value: true, source: 'override' });

    const notOverridden = await service.resolve('new-dashboard', 'org-2');
    expect(notOverridden).toEqual({ key: 'new-dashboard', value: false, source: 'default' });
  });

  it('removeOverride falls back to the resolution default afterwards', async () => {
    repository.findByKey
      .mockResolvedValueOnce(makeFlag({ organizationOverrides: { 'org-1': true } }))
      .mockResolvedValueOnce(makeFlag({ organizationOverrides: {} }));
    repository.removeOverride.mockResolvedValue(makeFlag({ organizationOverrides: {} }));

    await service.removeOverride('new-dashboard', 'org-1');
    expect(repository.removeOverride).toHaveBeenCalledWith('new-dashboard', 'org-1');
    expect(cacheService.invalidateTag).toHaveBeenCalledWith('feature-flag:new-dashboard');

    const resolved = await service.resolve('new-dashboard', 'org-1');
    expect(resolved.source).toBe('default');
  });

  it('returns the cached resolution without touching the repository on a cache hit', async () => {
    cacheService.get.mockResolvedValue({ key: 'new-dashboard', value: true, source: 'override' });

    const resolved = await service.resolve('new-dashboard', 'org-1');

    expect(resolved).toEqual({ key: 'new-dashboard', value: true, source: 'override' });
    expect(repository.findByKey).not.toHaveBeenCalled();
  });

  it('invalidates the cache tag on update, delete, and setOverride', async () => {
    repository.findByKey.mockResolvedValue(makeFlag());
    repository.update.mockResolvedValue(makeFlag({ name: 'Renamed' }));
    await service.update('new-dashboard', { name: 'Renamed' });
    expect(cacheService.invalidateTag).toHaveBeenCalledWith('feature-flag:new-dashboard');

    cacheService.invalidateTag.mockClear();
    await service.delete('new-dashboard');
    expect(cacheService.invalidateTag).toHaveBeenCalledWith('feature-flag:new-dashboard');

    cacheService.invalidateTag.mockClear();
    repository.setOverride.mockResolvedValue(
      makeFlag({ organizationOverrides: { 'org-1': true } }),
    );
    await service.setOverride('new-dashboard', 'org-1', true);
    expect(cacheService.invalidateTag).toHaveBeenCalledWith('feature-flag:new-dashboard');
  });
});
