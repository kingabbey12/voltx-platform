import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
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
import { VIRUS_SCAN_PROVIDER, VirusScanProvider } from './virus-scan/virus-scan-provider.interface';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { ERROR_CODES } from '../../common/errors/error-codes';
import { AuditService } from '../audit/audit.service';
import { UsageMeteringService } from '../billing/usage-metering.service';
import { QuotaService } from '../billing/quota.service';

export const MULTIPART_PART_SIZE_BYTES = 8 * 1024 * 1024; // 8MB — safely above S3's 5MB minimum part size

export interface UploadFileInput {
  fileName: string;
  mimeType: string;
  buffer: Buffer;
}

@Injectable()
export class AttachmentService {
  private readonly maxFileSizeBytes: number;
  private readonly isProduction: boolean;

  constructor(
    private readonly attachmentRepository: AttachmentRepository,
    @Inject(STORAGE_PROVIDER) private readonly storageProvider: StorageProvider,
    @Inject(VIRUS_SCAN_PROVIDER) private readonly virusScanProvider: VirusScanProvider,
    private readonly processingQueue: AttachmentProcessingQueueService,
    private readonly tenantContextService: TenantContextService,
    private readonly auditService: AuditService,
    private readonly usageMeteringService: UsageMeteringService,
    private readonly quotaService: QuotaService,
    configService: ConfigService,
  ) {
    this.maxFileSizeBytes = configService.get<number>(
      'attachments.maxFileSizeBytes',
      25 * 1024 * 1024,
    );
    this.isProduction = configService.get<string>('nodeEnv', '') === 'production';
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

  /**
   * ClamAV is an optional dependency (see VirusScanModule) — when it
   * isn't configured, VIRUS_SCAN_PROVIDER resolves to the no-op scanner
   * instead of crashing app boot. Uploads must never be accepted
   * unscanned, so in production the upload entry points refuse new
   * files outright until CLAMAV_HOST/CLAMAV_PORT are set. Outside
   * production the no-op scanner remains a local-dev convenience.
   */
  private assertUploadsAvailable(): void {
    if (this.isProduction && this.virusScanProvider.name !== 'clamav') {
      throw new ServiceUnavailableException({
        code: ERROR_CODES.attachmentScanningUnavailable,
        message:
          'File uploads are unavailable because antivirus scanning is not configured. ' +
          'Set CLAMAV_HOST and CLAMAV_PORT to enable uploads.',
      });
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
    this.assertUploadsAvailable();
    this.assertValid(input.mimeType, input.buffer.length);

    // Storage quota is checked here (against the real byte count) rather
    // than via FeatureGateGuard/@RequireFeature — a guard runs before
    // multer parses the multipart body, so it can never see the actual
    // file size the way this method already can.
    const quota = await this.quotaService.checkQuota(
      organizationId,
      'storage',
      input.buffer.length,
    );
    if (!quota.allowed) {
      throw new ForbiddenException({
        code: quota.reason ?? 'QUOTA_EXCEEDED',
        message:
          quota.reason === 'SUBSCRIPTION_INACTIVE'
            ? 'Your subscription is not active — update your billing to continue.'
            : "You have reached your plan's storage limit.",
        details: {
          featureKey: quota.featureKey,
          limit: quota.limit,
          currentUsage: quota.currentUsage,
        },
      });
    }

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

    void this.usageMeteringService.record(organizationId, 'storage', input.buffer.length);

    this.processingQueue.enqueue(attachment.id, organizationId);
    return attachment;
  }

  async initiateMultipartUpload(
    fileName: string,
    mimeType: string,
    sizeBytes: number,
  ): Promise<{ attachmentId: string; uploadId: string; partSizeBytes: number }> {
    this.assertUploadsAvailable();
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

    this.processingQueue.enqueue(attachmentId, attachment.organizationId);
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

  /**
   * Overwrites the extracted-text field outside the normal upload-time
   * pipeline — used by OcrService to backfill text for image attachments,
   * which the pipeline's TextExtractorRegistry never populates on its own
   * (OCR is a distinct, on-demand step, not part of every upload).
   */
  async updateExtractedText(id: string, extractedText: string): Promise<AttachmentEntity> {
    await this.attachmentRepository.findByIdOrThrow(id);
    return this.attachmentRepository.update(id, { extractedText });
  }

  async getSignedDownloadUrl(id: string): Promise<{ url: string; expiresAt: string }> {
    const attachment = await this.attachmentRepository.findByIdOrThrow(id);
    await this.assertNotQuarantined(attachment, 'signed_url');

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
    await this.assertNotQuarantined(attachment, 'download');
    const stream = await this.storageProvider.getReadStream(attachment.storageKey);
    return { stream, attachment };
  }

  async getThumbnailReadStream(
    id: string,
  ): Promise<{ stream: NodeJS.ReadableStream; attachment: AttachmentEntity }> {
    const attachment = await this.attachmentRepository.findByIdOrThrow(id);
    await this.assertNotQuarantined(attachment, 'thumbnail');
    if (!attachment.thumbnailKey) {
      throw new NotFoundException('This attachment has no thumbnail');
    }
    const stream = await this.storageProvider.getReadStream(attachment.thumbnailKey);
    return { stream, attachment };
  }

  /**
   * Bypasses the quarantine gate — the ONLY read path in this service that
   * does. Reserved for the admin-override endpoint, gated by the
   * `attachment.admin_override` permission (owner/admin roles only) and
   * distinctly audited, since a quarantined file failed a real virus scan.
   */
  async getReadStreamForDownloadAsAdmin(
    id: string,
  ): Promise<{ stream: NodeJS.ReadableStream; attachment: AttachmentEntity }> {
    const attachment = await this.attachmentRepository.findByIdOrThrow(id);
    const stream = await this.storageProvider.getReadStream(attachment.storageKey);

    await this.auditService.record({
      action: 'attachment.quarantine_override',
      resource: 'attachment',
      resourceId: id,
      metadata: { fileName: attachment.fileName, status: attachment.status },
    });

    return { stream, attachment };
  }

  private async assertNotQuarantined(
    attachment: AttachmentEntity,
    action: 'download' | 'signed_url' | 'thumbnail',
  ): Promise<void> {
    if (attachment.status !== 'QUARANTINED') {
      return;
    }

    await this.auditService.record({
      action: 'attachment.quarantine_blocked',
      resource: 'attachment',
      resourceId: attachment.id,
      metadata: { fileName: attachment.fileName, blockedAction: action },
    });

    throw new ForbiddenException('This file failed a virus scan and cannot be downloaded');
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
