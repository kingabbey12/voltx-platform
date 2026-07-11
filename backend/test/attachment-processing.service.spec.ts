import { Readable } from 'node:stream';
import { Test, TestingModule } from '@nestjs/testing';
import { AttachmentProcessingService } from '../src/modules/attachments/processing/attachment-processing.service';
import { AttachmentRepository } from '../src/modules/attachments/attachment.repository';
import { STORAGE_PROVIDER } from '../src/modules/attachments/storage/storage-provider.interface';
import { VIRUS_SCAN_PROVIDER } from '../src/modules/attachments/virus-scan/virus-scan-provider.interface';
import { ImageProcessingService } from '../src/modules/attachments/processing/image-processing.service';
import { TextExtractorRegistry } from '../src/modules/knowledge/extraction/text-extractor.registry';
import { AuditService } from '../src/modules/audit/audit.service';
import { NotificationService } from '../src/modules/notifications/notification.service';
import { AttachmentEntity } from '../src/modules/attachments/entities/attachment.entity';

describe('AttachmentProcessingService', () => {
  let service: AttachmentProcessingService;
  let repository: jest.Mocked<AttachmentRepository>;
  let virusScanProvider: { scan: jest.Mock };
  let notificationService: jest.Mocked<NotificationService>;
  let auditService: jest.Mocked<AuditService>;

  const attachmentEntity: AttachmentEntity = {
    id: 'attachment-1',
    organizationId: 'org-1',
    uploadedBy: 'user-1',
    fileName: 'infected.txt',
    mimeType: 'text/plain',
    sizeBytes: 10,
    storageProvider: 'local',
    storageKey: 'org-1/uuid/infected.txt',
    checksumSha256: null,
    status: 'PROCESSING',
    scanResult: null,
    thumbnailKey: null,
    width: null,
    height: null,
    extractedText: null,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttachmentProcessingService,
        {
          provide: AttachmentRepository,
          useValue: {
            findByIdUnscoped: jest.fn().mockResolvedValue(attachmentEntity),
            update: jest.fn().mockResolvedValue(attachmentEntity),
          },
        },
        {
          provide: STORAGE_PROVIDER,
          useValue: {
            getReadStream: jest.fn().mockResolvedValue(Readable.from([Buffer.from('bytes')])),
            upload: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: VIRUS_SCAN_PROVIDER,
          useValue: { scan: jest.fn() },
        },
        {
          provide: ImageProcessingService,
          useValue: { process: jest.fn() },
        },
        {
          provide: TextExtractorRegistry,
          useValue: { extract: jest.fn() },
        },
        {
          provide: AuditService,
          useValue: {
            record: jest.fn().mockResolvedValue(undefined),
            recordWithExplicitActor: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: NotificationService,
          useValue: { create: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get(AttachmentProcessingService);
    repository = module.get(AttachmentRepository);
    virusScanProvider = module.get(VIRUS_SCAN_PROVIDER);
    notificationService = module.get(NotificationService);
    auditService = module.get(AuditService);
  });

  it('notifies the uploader when a file is quarantined', async () => {
    virusScanProvider.scan.mockResolvedValue({
      clean: false,
      threat: 'Eicar-Test-Signature',
      skipped: false,
    });

    await service.process('attachment-1');

    expect(repository.update).toHaveBeenCalledWith(
      'attachment-1',
      expect.objectContaining({ status: 'QUARANTINED' }),
    );
    expect(auditService.recordWithExplicitActor).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'attachment.quarantined' }),
    );
    const [createArgs] = notificationService.create.mock.calls[0];
    expect(createArgs).toMatchObject({
      organizationId: 'org-1',
      userId: 'user-1',
      category: 'SECURITY',
    });
    expect(createArgs.title).toEqual(expect.stringContaining('quarantined'));
  });

  it('never notifies when the file scans clean', async () => {
    virusScanProvider.scan.mockResolvedValue({ clean: true, skipped: false });

    await service.process('attachment-1');

    expect(notificationService.create).not.toHaveBeenCalled();
  });

  it('does not fail processing if the notification itself throws', async () => {
    virusScanProvider.scan.mockResolvedValue({
      clean: false,
      threat: 'Eicar-Test-Signature',
      skipped: false,
    });
    notificationService.create.mockRejectedValue(new Error('notification service down'));

    await expect(service.process('attachment-1')).resolves.toBeUndefined();
    expect(repository.update).toHaveBeenCalledWith(
      'attachment-1',
      expect.objectContaining({ status: 'QUARANTINED' }),
    );
  });
});
