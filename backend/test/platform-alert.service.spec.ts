import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PlatformAlertEntity } from '../src/modules/platform/alerts/entities/platform-alert.entity';
import { PlatformAlertRepository } from '../src/modules/platform/alerts/platform-alert.repository';
import { PlatformAlertService } from '../src/modules/platform/alerts/platform-alert.service';

function makeAlert(overrides: Partial<PlatformAlertEntity> = {}): PlatformAlertEntity {
  return {
    id: 'alert-1',
    severity: 'WARNING',
    category: 'queue',
    status: 'OPEN',
    title: 'Queue backlog growing',
    description: null,
    sourceMetadata: {},
    organizationId: null,
    acknowledgedById: null,
    acknowledgedAt: null,
    resolvedById: null,
    resolvedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('PlatformAlertService', () => {
  let service: PlatformAlertService;
  let repository: jest.Mocked<PlatformAlertRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PlatformAlertService,
        {
          provide: PlatformAlertRepository,
          useValue: {
            create: jest.fn(),
            findMany: jest.fn(),
            findById: jest.fn(),
            acknowledge: jest.fn(),
            resolve: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(PlatformAlertService);
    repository = module.get(PlatformAlertRepository);
  });

  it('creates an alert', async () => {
    repository.create.mockResolvedValue(makeAlert());
    const result = await service.create({ severity: 'WARNING', category: 'queue', title: 'Test' });
    expect(result.id).toBe('alert-1');
    expect(repository.create).toHaveBeenCalledWith({
      severity: 'WARNING',
      category: 'queue',
      title: 'Test',
    });
  });

  it('throws NotFoundException for an unknown alert id', async () => {
    repository.findById.mockResolvedValue(null);
    await expect(service.getOrThrow('not-real')).rejects.toThrow(NotFoundException);
  });

  it('acknowledges an alert, recording the acting platform admin', async () => {
    repository.findById.mockResolvedValue(makeAlert());
    repository.acknowledge.mockResolvedValue(
      makeAlert({
        status: 'ACKNOWLEDGED',
        acknowledgedById: 'admin-1',
        acknowledgedAt: new Date(),
      }),
    );

    const result = await service.acknowledge('alert-1', 'admin-1');

    expect(repository.acknowledge).toHaveBeenCalledWith('alert-1', 'admin-1');
    expect(result.status).toBe('ACKNOWLEDGED');
  });

  it('resolves an alert, recording the acting platform admin', async () => {
    repository.findById.mockResolvedValue(makeAlert());
    repository.resolve.mockResolvedValue(
      makeAlert({ status: 'RESOLVED', resolvedById: 'admin-1', resolvedAt: new Date() }),
    );

    const result = await service.resolve('alert-1', 'admin-1');

    expect(repository.resolve).toHaveBeenCalledWith('alert-1', 'admin-1');
    expect(result.status).toBe('RESOLVED');
  });

  it('rejects acknowledging an alert that does not exist', async () => {
    repository.findById.mockResolvedValue(null);
    await expect(service.acknowledge('not-real', 'admin-1')).rejects.toThrow(NotFoundException);
    expect(repository.acknowledge).not.toHaveBeenCalled();
  });

  it('deletes an alert', async () => {
    repository.findById.mockResolvedValue(makeAlert());
    await service.delete('alert-1');
    expect(repository.delete).toHaveBeenCalledWith('alert-1');
  });
});
