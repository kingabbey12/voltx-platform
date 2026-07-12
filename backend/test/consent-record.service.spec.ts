import { Test, TestingModule } from '@nestjs/testing';
import { TenantContextService } from '../src/common/tenant/tenant-context.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { ConsentRecordRepository } from '../src/modules/compliance/consent-record/consent-record.repository';
import { ConsentRecordService } from '../src/modules/compliance/consent-record/consent-record.service';

describe('ConsentRecordService', () => {
  let service: ConsentRecordService;
  let repository: jest.Mocked<ConsentRecordRepository>;
  let auditService: jest.Mocked<AuditService>;

  beforeEach(async () => {
    repository = {
      create: jest.fn(),
      findHistory: jest.fn(),
      findByIdInOrg: jest.fn(),
    } as unknown as jest.Mocked<ConsentRecordRepository>;
    auditService = { record: jest.fn() } as unknown as jest.Mocked<AuditService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConsentRecordService,
        { provide: ConsentRecordRepository, useValue: repository },
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
        { provide: AuditService, useValue: auditService },
      ],
    }).compile();

    service = module.get(ConsentRecordService);
  });

  it('records a grant and audits it as compliance.consent.grant', async () => {
    repository.create.mockResolvedValue({ id: 'consent-1', granted: true } as never);

    await service.record({ userId: 'user-1', consentType: 'marketing_emails', granted: true });

    expect(repository.create).toHaveBeenCalledWith({
      userId: 'user-1',
      consentType: 'marketing_emails',
      granted: true,
      organizationId: 'org-1',
    });
    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'compliance.consent.grant' }),
    );
  });

  it('records a revocation and audits it as compliance.consent.revoke', async () => {
    repository.create.mockResolvedValue({ id: 'consent-2', granted: false } as never);

    await service.record({ userId: 'user-1', consentType: 'marketing_emails', granted: false });

    expect(auditService.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'compliance.consent.revoke' }),
    );
  });

  it('appends a new row per grant/revoke rather than mutating — history reflects every call', async () => {
    repository.create.mockResolvedValueOnce({ id: 'c-1', granted: true } as never);
    repository.create.mockResolvedValueOnce({ id: 'c-2', granted: false } as never);

    await service.record({ userId: 'user-1', consentType: 'marketing_emails', granted: true });
    await service.record({ userId: 'user-1', consentType: 'marketing_emails', granted: false });

    expect(repository.create).toHaveBeenCalledTimes(2);
  });

  it("scopes history queries to the caller's organization", async () => {
    repository.findHistory.mockResolvedValue([]);
    await service.history({ userId: 'user-1' });
    expect(repository.findHistory).toHaveBeenCalledWith({
      userId: 'user-1',
      organizationId: 'org-1',
    });
  });
});
