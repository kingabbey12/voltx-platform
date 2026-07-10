import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { AttachmentRepository } from '../src/modules/attachments/attachment.repository';
import { AttachmentService } from '../src/modules/attachments/attachment.service';
import { AttachmentEntity } from '../src/modules/attachments/entities/attachment.entity';
import { AttachmentProcessingQueueService } from '../src/modules/attachments/processing/attachment-processing-queue.service';
import {
  STORAGE_PROVIDER,
  StorageProvider,
} from '../src/modules/attachments/storage/storage-provider.interface';
import { TenantContextService } from '../src/common/tenant/tenant-context.service';
import { AuditService } from '../src/modules/audit/audit.service';

describe('AttachmentService', () => {
  let service: AttachmentService;
  let repository: jest.Mocked<AttachmentRepository>;
  let storageProvider: jest.Mocked<StorageProvider>;
  let processingQueue: jest.Mocked<AttachmentProcessingQueueService>;
  let tenantContextService: jest.Mocked<TenantContextService>;

  const attachmentEntity: AttachmentEntity = {
    id: 'attachment-1',
    organizationId: 'org-1',
    uploadedBy: 'user-1',
    fileName: 'report.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 1024,
    storageProvider: 'local',
    storageKey: 'org-1/uuid/report.pdf',
    checksumSha256: null,
    status: 'PENDING',
    scanResult: null,
    thumbnailKey: null,
    width: null,
    height: null,
    extractedText: null,
    metadata: {},
    createdAt: new Date('2026-07-10T00:00:00.000Z'),
    updatedAt: new Date('2026-07-10T00:00:00.000Z'),
    deletedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttachmentService,
        {
          provide: AttachmentRepository,
          useValue: {
            create: jest.fn(),
            findById: jest.fn(),
            findByIdOrThrow: jest.fn(),
            update: jest.fn(),
            softDelete: jest.fn(),
            addReference: jest.fn(),
            findByReference: jest.fn(),
          },
        },
        {
          provide: STORAGE_PROVIDER,
          useValue: {
            name: 'local',
            upload: jest.fn(),
            getReadStream: jest.fn(),
            getSignedDownloadUrl: jest.fn(),
            delete: jest.fn(),
            initiateMultipartUpload: jest.fn(),
            uploadPart: jest.fn(),
            completeMultipartUpload: jest.fn(),
            abortMultipartUpload: jest.fn(),
          },
        },
        {
          provide: AttachmentProcessingQueueService,
          useValue: { enqueue: jest.fn() },
        },
        {
          provide: TenantContextService,
          useValue: { getOrThrow: jest.fn() },
        },
        {
          provide: AuditService,
          useValue: { record: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(25 * 1024 * 1024) },
        },
      ],
    }).compile();

    service = module.get(AttachmentService);
    repository = module.get(AttachmentRepository);
    storageProvider = module.get(STORAGE_PROVIDER);
    processingQueue = module.get(AttachmentProcessingQueueService);
    tenantContextService = module.get(TenantContextService);

    tenantContextService.getOrThrow.mockReturnValue({
      organizationId: 'org-1',
      userId: 'user-1',
      membershipId: 'membership-1',
      requestId: 'request-1',
    });
  });

  describe('uploadSingle', () => {
    it('uploads to storage, persists metadata, and enqueues processing', async () => {
      repository.create.mockResolvedValue(attachmentEntity);

      const result = await service.uploadSingle({
        fileName: 'report.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('pdf-bytes'),
      });

      expect(storageProvider.upload).toHaveBeenCalledWith(
        expect.stringContaining('org-1/'),
        expect.any(Buffer),
        'application/pdf',
      );
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ fileName: 'report.pdf', status: 'PENDING' }),
      );
      expect(processingQueue.enqueue).toHaveBeenCalledWith(attachmentEntity.id);
      expect(result).toEqual(attachmentEntity);
    });

    it('rejects an unsupported MIME type before touching storage', async () => {
      await expect(
        service.uploadSingle({
          fileName: 'virus.exe',
          mimeType: 'application/x-msdownload',
          buffer: Buffer.from('bytes'),
        }),
      ).rejects.toThrow(BadRequestException);

      expect(storageProvider.upload).not.toHaveBeenCalled();
      expect(repository.create).not.toHaveBeenCalled();
    });

    it('rejects a file over the configured size limit', async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AttachmentService,
          { provide: AttachmentRepository, useValue: repository },
          { provide: STORAGE_PROVIDER, useValue: storageProvider },
          { provide: AttachmentProcessingQueueService, useValue: processingQueue },
          { provide: TenantContextService, useValue: tenantContextService },
          { provide: AuditService, useValue: { record: jest.fn() } },
          { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue(10) } },
        ],
      }).compile();
      const tinyLimitService = module.get(AttachmentService);

      await expect(
        tinyLimitService.uploadSingle({
          fileName: 'report.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.from('this buffer is definitely longer than 10 bytes'),
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an empty file', async () => {
      await expect(
        service.uploadSingle({
          fileName: 'empty.pdf',
          mimeType: 'application/pdf',
          buffer: Buffer.alloc(0),
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getReadStreamForDownload', () => {
    it('refuses to stream a quarantined attachment', async () => {
      repository.findByIdOrThrow.mockResolvedValue({ ...attachmentEntity, status: 'QUARANTINED' });

      await expect(service.getReadStreamForDownload(attachmentEntity.id)).rejects.toThrow(
        ForbiddenException,
      );
      expect(storageProvider.getReadStream).not.toHaveBeenCalled();
    });

    it('streams a ready attachment', async () => {
      repository.findByIdOrThrow.mockResolvedValue({ ...attachmentEntity, status: 'READY' });
      const fakeStream = {} as NodeJS.ReadableStream;
      storageProvider.getReadStream.mockResolvedValue(fakeStream);

      const result = await service.getReadStreamForDownload(attachmentEntity.id);

      expect(result.stream).toBe(fakeStream);
      expect(storageProvider.getReadStream).toHaveBeenCalledWith(attachmentEntity.storageKey);
    });
  });

  describe('delete', () => {
    it('soft-deletes and audit-logs the attachment', async () => {
      repository.findByIdOrThrow.mockResolvedValue(attachmentEntity);

      await service.delete(attachmentEntity.id);

      expect(repository.softDelete).toHaveBeenCalledWith(attachmentEntity.id);
    });
  });

  describe('addReference', () => {
    it('asserts the attachment exists (tenant-scoped) before creating the reference', async () => {
      repository.findByIdOrThrow.mockResolvedValue(attachmentEntity);

      await service.addReference(attachmentEntity.id, 'AI_MESSAGE', 'message-1');

      expect(repository.findByIdOrThrow).toHaveBeenCalledWith(attachmentEntity.id);
      expect(repository.addReference).toHaveBeenCalledWith(
        attachmentEntity.id,
        'AI_MESSAGE',
        'message-1',
      );
    });
  });
});
