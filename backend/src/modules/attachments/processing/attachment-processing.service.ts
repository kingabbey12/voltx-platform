import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { AttachmentRepository } from '../attachment.repository';
import { STORAGE_PROVIDER, StorageProvider } from '../storage/storage-provider.interface';
import {
  VIRUS_SCAN_PROVIDER,
  VirusScanProvider,
} from '../virus-scan/virus-scan-provider.interface';
import {
  DOCUMENT_MIME_TYPE_TO_EXTRACTOR_CONTENT_TYPE,
  isImageMimeType,
} from '../supported-mime-types';
import { ImageProcessingService } from './image-processing.service';
import { TextExtractorRegistry } from '../../knowledge/extraction/text-extractor.registry';
import { AuditService } from '../../audit/audit.service';
import { NotificationService } from '../../notifications/notification.service';
import { streamToBuffer } from '../stream-to-buffer.util';

/**
 * The actual scan → (thumbnail | extract) → persist pipeline, shared by
 * the synchronous fallback (no Redis configured) and the BullMQ worker
 * (attachment-processing.processor.ts) so there is exactly one
 * implementation of "what happens to an uploaded file" regardless of how
 * it gets invoked.
 */
@Injectable()
export class AttachmentProcessingService {
  private readonly logger = new Logger(AttachmentProcessingService.name);

  constructor(
    private readonly attachmentRepository: AttachmentRepository,
    @Inject(STORAGE_PROVIDER) private readonly storageProvider: StorageProvider,
    @Inject(VIRUS_SCAN_PROVIDER) private readonly virusScanProvider: VirusScanProvider,
    private readonly imageProcessingService: ImageProcessingService,
    private readonly textExtractorRegistry: TextExtractorRegistry,
    private readonly auditService: AuditService,
    private readonly notificationService: NotificationService,
  ) {}

  async process(attachmentId: string): Promise<void> {
    const attachment = await this.attachmentRepository.findByIdUnscoped(attachmentId);
    if (!attachment) {
      this.logger.warn(`Attachment "${attachmentId}" not found — skipping processing`);
      return;
    }

    await this.attachmentRepository.update(attachmentId, { status: 'PROCESSING' });

    const stream = await this.storageProvider.getReadStream(attachment.storageKey);
    const buffer = await streamToBuffer(stream);
    const checksumSha256 = createHash('sha256').update(buffer).digest('hex');

    const scanResult = await this.virusScanProvider.scan(buffer);
    if (!scanResult.clean) {
      await this.attachmentRepository.update(attachmentId, {
        status: 'QUARANTINED',
        scanResult: scanResult.threat ?? 'unknown threat',
        checksumSha256,
      });
      await this.auditService.recordWithExplicitActor({
        action: 'attachment.quarantined',
        resource: 'attachment',
        resourceId: attachmentId,
        organizationId: attachment.organizationId,
        userId: attachment.uploadedBy,
        metadata: { threat: scanResult.threat },
      });
      await this.notifyUploaderOfQuarantine(attachment, scanResult.threat ?? null);
      return;
    }

    const scanResultLabel = scanResult.skipped ? 'skipped' : 'clean';

    if (isImageMimeType(attachment.mimeType)) {
      const processed = await this.imageProcessingService.process(buffer);
      const thumbnailKey = `${attachment.storageKey}.thumb.webp`;
      await this.storageProvider.upload(thumbnailKey, processed.thumbnailBuffer, 'image/webp');
      await this.storageProvider.upload(
        attachment.storageKey,
        processed.optimizedBuffer,
        'image/webp',
      );

      await this.attachmentRepository.update(attachmentId, {
        status: 'READY',
        scanResult: scanResultLabel,
        thumbnailKey,
        width: processed.dimensions.width,
        height: processed.dimensions.height,
        checksumSha256,
      });
      return;
    }

    const extractorContentType = DOCUMENT_MIME_TYPE_TO_EXTRACTOR_CONTENT_TYPE[attachment.mimeType];
    if (extractorContentType) {
      try {
        const extractedText = await this.textExtractorRegistry.extract({
          contentType: extractorContentType,
          buffer,
        });
        await this.attachmentRepository.update(attachmentId, {
          status: 'READY',
          scanResult: scanResultLabel,
          extractedText,
          checksumSha256,
        });
      } catch (error) {
        this.logger.error({ err: error, attachmentId }, 'Text extraction failed');
        await this.attachmentRepository.update(attachmentId, {
          status: 'FAILED',
          scanResult: scanResultLabel,
          checksumSha256,
        });
      }
      return;
    }

    // Supported at upload validation time but no processing step applies
    // (shouldn't happen given isSupportedMimeType gates uploads, but fail
    // safe rather than leaving the row stuck in PROCESSING forever).
    await this.attachmentRepository.update(attachmentId, {
      status: 'READY',
      scanResult: scanResultLabel,
      checksumSha256,
    });
  }

  /** Best-effort — must never fail the quarantine itself over a notification-delivery problem. */
  private async notifyUploaderOfQuarantine(
    attachment: { organizationId: string; uploadedBy: string; fileName: string; id: string },
    threat: string | null,
  ): Promise<void> {
    try {
      await this.notificationService.create({
        organizationId: attachment.organizationId,
        userId: attachment.uploadedBy,
        category: 'SECURITY',
        title: `File quarantined: ${attachment.fileName}`,
        body: threat
          ? `This file failed a virus scan (${threat}) and cannot be downloaded.`
          : 'This file failed a virus scan and cannot be downloaded.',
        metadata: { attachmentId: attachment.id, threat },
      });
    } catch (error) {
      this.logger.warn(
        { err: error, attachmentId: attachment.id },
        'Failed to notify uploader of attachment quarantine',
      );
    }
  }
}
