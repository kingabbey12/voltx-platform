import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuditExportFormat } from '@prisma/client';
import { TenantContextService } from '../src/common/tenant/tenant-context.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { STORAGE_PROVIDER } from '../src/modules/attachments/storage/storage-provider.interface';
import { AuditComplianceService } from '../src/modules/compliance/audit-compliance/audit-compliance.service';
import { AuditExportRepository } from '../src/modules/compliance/audit-compliance/audit-export.repository';

describe('AuditComplianceService', () => {
  let service: AuditComplianceService;
  let auditExportRepository: jest.Mocked<AuditExportRepository>;
  let auditService: jest.Mocked<AuditService>;
  let storageProvider: { upload: jest.Mock; getSignedDownloadUrl: jest.Mock };

  beforeEach(async () => {
    auditExportRepository = {
      create: jest.fn().mockResolvedValue({ id: 'export-1' }),
      markCompleted: jest
        .fn()
        .mockImplementation((id: string, storageKey: string, rowCount: number) =>
          Promise.resolve({ id, status: 'COMPLETED', storageKey, rowCount }),
        ),
      markFailed: jest.fn(),
      findByIdInOrg: jest.fn(),
      listByOrganization: jest.fn(),
    } as unknown as jest.Mocked<AuditExportRepository>;

    auditService = {
      findByDateRange: jest.fn().mockResolvedValue([
        {
          id: 'log-1',
          createdAt: new Date(),
          userId: 'u-1',
          action: 'a',
          resource: 'r',
          resourceId: null,
          requestId: 'req-1',
          previousHash: null,
          hash: 'h1',
          metadata: {},
        },
      ]),
      verifyChain: jest.fn().mockResolvedValue({
        valid: true,
        checked: 1,
        brokenAtIndex: null,
        brokenAuditLogId: null,
      }),
      record: jest.fn(),
    } as unknown as jest.Mocked<AuditService>;

    storageProvider = {
      upload: jest.fn().mockResolvedValue(undefined),
      getSignedDownloadUrl: jest.fn().mockResolvedValue('https://storage.example.com/export.json'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditComplianceService,
        { provide: AuditExportRepository, useValue: auditExportRepository },
        { provide: AuditService, useValue: auditService },
        {
          provide: TenantContextService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue({
              organizationId: 'org-1',
              userId: 'admin-1',
              membershipId: 'm-1',
              requestId: 'req-1',
            }),
          },
        },
        { provide: STORAGE_PROVIDER, useValue: storageProvider },
      ],
    }).compile();

    service = module.get(AuditComplianceService);
  });

  it('rejects an invalid date range', async () => {
    await expect(service.createExport('not-a-date', '2026-01-01')).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.createExport('2026-02-01', '2026-01-01')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('uploads the serialized rows and marks the export completed', async () => {
    const { auditExport, downloadUrl } = await service.createExport(
      '2026-01-01',
      '2026-01-31',
      AuditExportFormat.JSON,
    );

    expect(storageProvider.upload).toHaveBeenCalledWith(
      expect.stringContaining('compliance/audit-exports/org-1/'),
      expect.any(Buffer),
      'application/json',
    );
    expect(auditExportRepository.markCompleted).toHaveBeenCalledWith(
      'export-1',
      expect.any(String),
      1,
    );
    expect(auditExport.status).toBe('COMPLETED');
    expect(downloadUrl).toBe('https://storage.example.com/export.json');
  });

  it('marks the export failed and rethrows if storage upload fails', async () => {
    storageProvider.upload.mockRejectedValue(new Error('storage unavailable'));

    await expect(service.createExport('2026-01-01', '2026-01-31')).rejects.toThrow(
      'storage unavailable',
    );
    expect(auditExportRepository.markFailed).toHaveBeenCalledWith(
      'export-1',
      'storage unavailable',
    );
  });

  it('serializes to CSV with a header row when format is CSV', async () => {
    await service.createExport('2026-01-01', '2026-01-31', AuditExportFormat.CSV);

    const [, buffer, contentType] = storageProvider.upload.mock.calls[0] as [
      string,
      Buffer,
      string,
    ];
    expect(contentType).toBe('text/csv');
    expect(buffer.toString('utf-8')).toContain('id,createdAt,userId,action,resource');
  });

  it("delegates verifyChain to AuditService, scoped to the caller's organization", async () => {
    const result = await service.verifyChain();
    expect(auditService.verifyChain).toHaveBeenCalledWith('org-1');
    expect(result.valid).toBe(true);
  });
});
