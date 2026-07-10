import { Test, TestingModule } from '@nestjs/testing';
import { AttachmentContentBuilderService } from '../src/modules/attachments/attachment-content-builder.service';
import { AttachmentRepository } from '../src/modules/attachments/attachment.repository';
import { AttachmentEntity } from '../src/modules/attachments/entities/attachment.entity';
import {
  STORAGE_PROVIDER,
  StorageProvider,
} from '../src/modules/attachments/storage/storage-provider.interface';
import { Readable } from 'node:stream';

function buildAttachment(overrides: Partial<AttachmentEntity>): AttachmentEntity {
  return {
    id: 'attachment-1',
    organizationId: 'org-1',
    uploadedBy: 'user-1',
    fileName: 'file.txt',
    mimeType: 'text/plain',
    sizeBytes: 100,
    storageProvider: 'local',
    storageKey: 'org-1/uuid/file.txt',
    checksumSha256: null,
    status: 'READY',
    scanResult: 'clean',
    thumbnailKey: null,
    width: null,
    height: null,
    extractedText: null,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

describe('AttachmentContentBuilderService', () => {
  let service: AttachmentContentBuilderService;
  let repository: jest.Mocked<AttachmentRepository>;
  let storageProvider: jest.Mocked<StorageProvider>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttachmentContentBuilderService,
        { provide: AttachmentRepository, useValue: { findByIds: jest.fn() } },
        {
          provide: STORAGE_PROVIDER,
          useValue: { getReadStream: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(AttachmentContentBuilderService);
    repository = module.get(AttachmentRepository);
    storageProvider = module.get(STORAGE_PROVIDER);
  });

  it('returns an empty array when no attachment ids are given', async () => {
    const result = await service.build([], true);
    expect(result).toEqual([]);
    expect(repository.findByIds).not.toHaveBeenCalled();
  });

  it('includes extracted text for a ready document attachment', async () => {
    repository.findByIds.mockResolvedValue([
      buildAttachment({
        mimeType: 'application/pdf',
        extractedText: 'The quarterly report says X.',
      }),
    ]);

    const result = await service.build(['attachment-1'], true);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('text');
    if (result[0].type === 'text') {
      expect(result[0].text).toContain('The quarterly report says X.');
    }
  });

  it('inlines image bytes as base64 when the model supports vision', async () => {
    repository.findByIds.mockResolvedValue([buildAttachment({ mimeType: 'image/jpeg' })]);
    storageProvider.getReadStream.mockResolvedValue(
      Readable.from([Buffer.from('fake-image-bytes')]),
    );

    const result = await service.build(['attachment-1'], true);

    expect(result).toEqual([
      {
        type: 'image',
        mimeType: 'image/webp',
        base64Data: Buffer.from('fake-image-bytes').toString('base64'),
      },
    ]);
  });

  it('falls back to a text placeholder for images when the model does not support vision', async () => {
    repository.findByIds.mockResolvedValue([buildAttachment({ mimeType: 'image/jpeg' })]);

    const result = await service.build(['attachment-1'], false);

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('text');
    expect(storageProvider.getReadStream).not.toHaveBeenCalled();
  });

  it('placeholders an attachment that has not finished processing yet', async () => {
    repository.findByIds.mockResolvedValue([buildAttachment({ status: 'PROCESSING' })]);

    const result = await service.build(['attachment-1'], true);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ type: 'text' });
    if (result[0].type === 'text') {
      expect(result[0].text).toContain('still processing');
    }
  });

  it('placeholders a document with no extracted text', async () => {
    repository.findByIds.mockResolvedValue([
      buildAttachment({ mimeType: 'application/pdf', extractedText: null }),
    ]);

    const result = await service.build(['attachment-1'], true);

    expect(result).toHaveLength(1);
    if (result[0].type === 'text') {
      expect(result[0].text).toContain('no extractable text');
    }
  });
});
