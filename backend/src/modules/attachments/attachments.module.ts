import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
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
import { ATTACHMENT_PROCESS_QUEUE } from './processing/attachment-processing.constants';
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
// BullModule.forRoot is @Global() and safe to call again here with the
// same connection config communications.module.ts already registers it
// with — Nest/BullMQ's documented pattern for feature modules that each
// need their own queue.
const redisEnabled = process.env.REDIS_ENABLED === 'true';
const queueImports = redisEnabled
  ? [
      BullModule.forRoot({
        connection: { url: process.env.REDIS_URL ?? 'redis://localhost:6379' },
      }),
      BullModule.registerQueue({ name: ATTACHMENT_PROCESS_QUEUE }),
    ]
  : [];
const queueProcessors = redisEnabled ? [AttachmentProcessingProcessor] : [];

@Module({
  imports: [
    AuditModule,
    BillingModule,
    KnowledgeModule,
    StorageModule,
    VirusScanModule,
    ToolModule,
    ...queueImports,
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
