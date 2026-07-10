import { Inject, Injectable, Logger } from '@nestjs/common';
import { AIContentPart } from '../ai/models/ai-model.types';
import { AttachmentRepository } from './attachment.repository';
import { isImageMimeType } from './supported-mime-types';
import { STORAGE_PROVIDER, StorageProvider } from './storage/storage-provider.interface';

function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  return new Promise((resolvePromise, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolvePromise(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

/**
 * Resolves attachmentIds into AIContentPart[] for an AI request — the seam
 * between "an attachment exists" and "the model can see it". Images
 * become inline base64 image parts only when the target model supports
 * vision (fetched fresh from storage, not cached, since we never persist
 * raw image bytes in the database); every other supported type uses the
 * text already extracted at upload time (attachment-processing.service.ts)
 * rather than re-parsing the file on every AI turn.
 */
@Injectable()
export class AttachmentContentBuilderService {
  private readonly logger = new Logger(AttachmentContentBuilderService.name);

  constructor(
    private readonly attachmentRepository: AttachmentRepository,
    @Inject(STORAGE_PROVIDER) private readonly storageProvider: StorageProvider,
  ) {}

  async build(attachmentIds: string[], modelSupportsVision: boolean): Promise<AIContentPart[]> {
    if (attachmentIds.length === 0) {
      return [];
    }

    const attachments = await this.attachmentRepository.findByIds(attachmentIds);
    const parts: AIContentPart[] = [];

    for (const attachment of attachments) {
      if (attachment.status !== 'READY') {
        parts.push({
          type: 'text',
          text: `[Attachment "${attachment.fileName}" is still processing and isn't available yet.]`,
        });
        continue;
      }

      if (isImageMimeType(attachment.mimeType)) {
        if (!modelSupportsVision) {
          parts.push({
            type: 'text',
            text: `[Image attached: "${attachment.fileName}" — the current model does not support image input, so it could not be included.]`,
          });
          continue;
        }
        try {
          const stream = await this.storageProvider.getReadStream(attachment.storageKey);
          const buffer = await streamToBuffer(stream);
          parts.push({
            type: 'image',
            mimeType: 'image/webp', // attachment-processing.service.ts re-encodes all images to webp
            base64Data: buffer.toString('base64'),
          });
        } catch (error) {
          this.logger.error(
            { err: error, attachmentId: attachment.id },
            'Failed to load image attachment content',
          );
          parts.push({
            type: 'text',
            text: `[Image "${attachment.fileName}" could not be loaded.]`,
          });
        }
        continue;
      }

      if (attachment.extractedText) {
        parts.push({
          type: 'text',
          text: `--- Attached file: ${attachment.fileName} ---\n${attachment.extractedText}`,
        });
      } else {
        parts.push({
          type: 'text',
          text: `[Attachment "${attachment.fileName}" has no extractable text content.]`,
        });
      }
    }

    return parts;
  }
}
