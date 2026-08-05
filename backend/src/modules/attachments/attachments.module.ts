import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { BillingModule } from '../billing/billing.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { ToolModule } from '../ai/tools/tool.module';
import { AttachmentContentBuilderService } from './attachment-content-builder.service';
import { AttachmentController } from './attachment.controller';
import { AttachmentRepository } from './attachment.repository';
import { AttachmentService } from './attachment.service';
import { AttachmentProcessingQueueService } from './processing/attachment-processing-queue.service';
import { AttachmentProcessingProcessor } from './processing/attachment-processing.processor';
import { AttachmentProcessingService } from './processing/attachment-processing.service';
import { ImageProcessingService } from './processing/image-processing.service';
import { StorageModule } from './storage/storage.module';
import { VirusScanModule } from './virus-scan/virus-scan.module';
import { AttachmentsToolSourceService } from './tools/attachments-tool-source.service';
import { DocumentToolSourceService } from './documents/document-tool-source.service';
import { OcrService } from './documents/ocr.service';
import { PdfGenerationService } from './documents/pdf-generation.service';

// Same REDIS_ENABLED-gated pattern as communications.module.ts's AI process
// queue — when Redis isn't configured, AttachmentProcessingQueueService
// falls back to processing uploads synchronously instead of enqueuing.
const redisEnabled = process.env.REDIS_ENABLED === 'true';
const queueProcessors = redisEnabled ? [AttachmentProcessingProcessor] : [];

@Module({
  imports: [
    AuditModule,
    BillingModule,
    KnowledgeModule,
    StorageModule,
    VirusScanModule,
    ToolModule,
  ],
  controllers: [AttachmentController],
  providers: [
    AttachmentRepository,
    AttachmentService,
    AttachmentContentBuilderService,
    AttachmentProcessingService,
    AttachmentProcessingQueueService,
    ImageProcessingService,
    AttachmentsToolSourceService,
    PdfGenerationService,
    OcrService,
    DocumentToolSourceService,
    ...queueProcessors,
  ],
  exports: [AttachmentService, AttachmentRepository, AttachmentContentBuilderService],
})
export class AttachmentsModule {}
