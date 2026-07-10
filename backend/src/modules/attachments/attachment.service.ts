import { BadRequestException, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import {
  AttachmentRepository,
  FindAttachmentsParams,
  PaginatedAttachments,
} from './attachment.repository';
import { AttachmentEntity, AttachmentReferenceType } from './entities/attachment.entity';
import { AttachmentProcessingQueueService } from './processing/attachment-processing-queue.service';
import { STORAGE_PROVIDER, StorageProvider } from './storage/storage-provider.interface';
import { isSupportedMimeType } from './supported-mime-types';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { AuditService } from '../audit/audit.service';

export const MULTIPART_PART_SIZE_BYTES = 8 * 1024 * 1024; // 8MB — safely above S3's 5MB minimum part size

export interface UploadFileInput {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}

@Injectable()
export class AttachmentService {
  private readonly maxFileSizeBytes: number;

  constructor(
    private readonly attachmentRepository: AttachmentRepository,
    @Inject(STORAGE_PROVIDER) private readonly storageProvider: StorageProvider,
    private readonly processingQueue: AttachmentProcessingQueueService,
    private readonly tenantContextService: TenantContextService,
    private readonly auditService: AuditService,
    configService: ConfigService,
  ) {
    this.maxFileSizeBytes = configService.get<number>(
      'attachments.maxFileSizeBytes',
      25 * 1024 * 1024,
    );
  }

  private assertValid(mimeType: string, sizeBytes: number): void {
    if (!isSupportedMimeType(mimeType)) {
      throw new BadRequestException(`Unsupported file type: "${mimeType}"`);
    }
    if (sizeBytes > this.maxFileSizeBytes) {
      throw new BadRequestException(
        `File exceeds the maximum allowed size of ${Math.floor(this.maxFileSizeBytes / 1024 / 1024)}MB`,
      );
    }
    if (sizeBytes <= 0) {
      throw new BadRequestException('File is empty');
    }
  }

  async uploadSingle(input: UploadFileInput): Promise<AttachmentEntity> {
    const tenant = this.tenantContextService.getOrThrow();
    return this.uploadSingleUnscoped(tenant.organizationId, tenant.userId, input);
  }

  /**
   * For background/webhook contexts (e.g. ingesting an attachment that
   * arrived on an inbound Slack/WhatsApp/email message) that have no
   * HTTP-request tenant context — takes organizationId/uploaderId
   * explicitly instead, mirroring the *Unscoped naming convention already
   * used by the communications module's repositories for the same reason.
   */
  async uploadSingleUnscoped(
    organizationId: string,
    uploaderId: string,
    input: UploadFileInput,
  ): Promise<AttachmentEntity> {
    this.assertValid(input.mimeType, input.buffer.length);

    const storageKey = buildStorageKey(organizationId, input.fileName);
    await this.storageProvider.upload(storageKey, input.buffer, input.mimeType);

    let attachment: AttachmentEntity;
    try {
      attachment = await this.attachmentRepository.createUnscoped(organizationId, {
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: input.buffer.length,
        storageProvider: this.storageProvider.name,
        storageKey,
        status: 'PENDING',
        uploadedBy: uploaderId,
      });
    } catch (error) {
      // The file already landed in storage — if we can't persist its
      // metadata, don't leave it behind as an orphan with nothing in the
      // database ever pointing to it.
      await this.storageProvider.delete(storageKey).catch(() => undefined);
      throw error;
    }

    // No HTTP-request tenant context here, so record with an explicit
    // actor rather than the tenant-context-reading record().
    await this.auditService.recordWithExplicitActor({
      organizationId,
      userId: uploaderId,
      action: 'attachment.uploaded',
      resource: 'attachment',
      resourceId: attachment.id,
      metadata: {
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: input.buffer.length,
      },
    });

    this.processingQueue.enqueue(attachment.id);
    return attachment;
  }

  async initiateMultipartUpload(
    fileName: string,
    mimeType: string,
    sizeBytes: number,
  ): Promise<{ attachmentId: string; uploadId: string; partSizeBytes: number }> {
    this.assertValid(mimeType, sizeBytes);
    const tenant = this.tenantContextService.getOrThrow();

    const storageKey = buildStorageKey(tenant.organizationId, fileName);
    const uploadId = await this.storageProvider.initiateMultipartUpload(storageKey, mimeType);

    let attachment: AttachmentEntity;
    try {
      attachment = await this.attachmentRepository.create({
        fileName,
        mimeType,
        sizeBytes,
        storageProvider: this.storageProvider.name,
        storageKey,
        status: 'UPLOADING',
        uploadedBy: tenant.userId,
      });
    } catch (error) {
      // Leaving an incomplete multipart upload behind isn't just an
      // orphaned-file risk — S3-compatible providers bill for
      // uncompleted parts until they're aborted.
      await this.storageProvider.abortMultipartUpload(storageKey, uploadId).catch(() => undefined);
      throw error;
    }

    return { attachmentId: attachment.id, uploadId, partSizeBytes: MULTIPART_PART_SIZE_BYTES };
  }

  async uploadPart(
    attachmentId: string,
    uploadId: string,
    partNumber: number,
    buffer: Buffer,
  ): Promise<{ partNumber: number; etag: string }> {
    const attachment = await this.attachmentRepository.findByIdOrThrow(attachmentId);
    return this.storageProvider.uploadPart(attachment.storageKey, uploadId, partNumber, buffer);
  }

  async completeMultipartUpload(
    attachmentId: string,
    uploadId: string,
    parts: Array<{ partNumber: number; etag: string }>,
  ): Promise<AttachmentEntity> {
    const attachment = await this.attachmentRepository.findByIdOrThrow(attachmentId);
    const { sizeBytes } = await this.storageProvider.completeMultipartUpload(
      attachment.storageKey,
      uploadId,
      parts,
    );

    // The client's declared size at initiate-time is untrusted — a
    // malicious/misbehaving client could initiate with a small size and
    // then upload far more/larger parts than that, bypassing the max
    // file size limit entirely. Re-validate against the real, assembled
    // size and refuse to keep an oversized object around.
    if (sizeBytes > this.maxFileSizeBytes) {
      await this.storageProvider.delete(attachment.storageKey);
      await this.attachmentRepository.softDelete(attachmentId);
      throw new BadRequestException(
        `Assembled file (${sizeBytes} bytes) exceeds the maximum allowed size of ${Math.floor(this.maxFileSizeBytes / 1024 / 1024)}MB`,
      );
    }

    const updated = await this.attachmentRepository.update(attachmentId, {
      status: 'PENDING',
      sizeBytes,
    });

    await this.auditService.record({
      action: 'attachment.uploaded',
      resource: 'attachment',
      resourceId: attachmentId,
      metadata: { fileName: attachment.fileName, mimeType: attachment.mimeType, multipart: true },
    });

    this.processingQueue.enqueue(attachmentId);
    return updated;
  }

  async abortMultipartUpload(attachmentId: string, uploadId: string): Promise<void> {
    const attachment = await this.attachmentRepository.findByIdOrThrow(attachmentId);
    await this.storageProvider.abortMultipartUpload(attachment.storageKey, uploadId);
    await this.attachmentRepository.softDelete(attachmentId);
  }

  async getById(id: string): Promise<AttachmentEntity> {
    return this.attachmentRepository.findByIdOrThrow(id);
  }

  async getSignedDownloadUrl(id: string): Promise<{ url: string; expiresAt: string }> {
    const attachment = await this.attachmentRepository.findByIdOrThrow(id);
    const ttlSeconds = 900;
    const url = await this.storageProvider.getSignedDownloadUrl(
      attachment.storageKey,
      ttlSeconds,
      attachment.fileName,
    );
    return { url, expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString() };
  }

  async getReadStreamForDownload(
    id: string,
  ): Promise<{ stream: NodeJS.ReadableStream; attachment: AttachmentEntity }> {
    const attachment = await this.attachmentRepository.findByIdOrThrow(id);
    if (attachment.status === 'QUARANTINED') {
      throw new ForbiddenException('This file failed a virus scan and cannot be downloaded');
    }
    const stream = await this.storageProvider.getReadStream(attachment.storageKey);
    return { stream, attachment };
  }

  async delete(id: string): Promise<void> {
    const attachment = await this.attachmentRepository.findByIdOrThrow(id);
    await this.attachmentRepository.softDelete(id);
    await this.auditService.record({
      action: 'attachment.deleted',
      resource: 'attachment',
      resourceId: id,
      metadata: { fileName: attachment.fileName },
    });
  }

  async addReference(
    id: string,
    referenceType: AttachmentReferenceType,
    referenceId: string,
  ): Promise<void> {
    await this.attachmentRepository.findByIdOrThrow(id); // asserts tenant ownership
    await this.attachmentRepository.addReference(id, referenceType, referenceId);
    await this.auditService.record({
      action: 'attachment.referenced',
      resource: 'attachment',
      resourceId: id,
      metadata: { referenceType, referenceId },
    });
  }

  /** For background/webhook contexts — see uploadSingleUnscoped. */
  async addReferenceUnscoped(
    organizationId: string,
    id: string,
    referenceType: AttachmentReferenceType,
    referenceId: string,
  ): Promise<void> {
    await this.attachmentRepository.addReferenceUnscoped(
      organizationId,
      id,
      referenceType,
      referenceId,
    );
  }

  async listByReference(params: FindAttachmentsParams): Promise<PaginatedAttachments> {
    return this.attachmentRepository.findByReference(params);
  }

  async search(params: {
    query?: string;
    page: number;
    limit: number;
  }): Promise<PaginatedAttachments> {
    return this.attachmentRepository.search(params);
  }
}

function buildStorageKey(organizationId: string, fileName: string): string {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${organizationId}/${randomUUID()}/${safeName}`;
}
