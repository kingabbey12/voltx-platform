import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from '../src/modules/audit/audit.service';
import { TrustedDeviceRepository } from '../src/modules/auth/trusted-device.repository';
import { TrustedDevicesService } from '../src/modules/security/trusted-devices.service';

describe('TrustedDevicesService', () => {
  let service: TrustedDevicesService;
  let trustedDeviceRepository: jest.Mocked<TrustedDeviceRepository>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrustedDevicesService,
        {
          provide: TrustedDeviceRepository,
          useValue: {
            listActiveForUserInOrganization: jest.fn(),
            upsertTrust: jest.fn(),
            findByIdForUserInOrganization: jest.fn(),
            revoke: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((_key: string, fallback: unknown) => fallback) },
        },
        { provide: AuditService, useValue: { record: jest.fn() } },
      ],
    }).compile();

    service = module.get(TrustedDevicesService);
    trustedDeviceRepository = module.get(TrustedDeviceRepository);
  });

  it('trusts a device for the configured default window when trustedForDays is omitted', async () => {
    trustedDeviceRepository.upsertTrust.mockResolvedValue({
      id: 'device-1',
      userId: 'user-1',
      organizationId: 'org-1',
      deviceFingerprint: 'fp-1',
      label: null,
      lastSeenAt: new Date(),
      trustedUntil: new Date('2026-08-09'),
      revokedAt: null,
      createdAt: new Date(),
    });

    await service.trust('user-1', 'org-1', { deviceFingerprint: 'fp-1' });

    expect(trustedDeviceRepository.upsertTrust).toHaveBeenCalledWith(
      'user-1',
      'org-1',
      'fp-1',
      expect.any(Date),
      undefined,
    );
  });

  it('rejects revoking a device that does not belong to the caller', async () => {
    trustedDeviceRepository.findByIdForUserInOrganization.mockResolvedValue(null);
    await expect(service.revoke('device-1', 'user-1', 'org-1')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(trustedDeviceRepository.revoke).not.toHaveBeenCalled();
  });
});
