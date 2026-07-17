import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { randomUUID } from 'node:crypto';
import { MembershipStatus } from '@prisma/client';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { PrismaService } from '../../../database/prisma.service';
import { AIProviderName } from '../../ai/models/ai-model.types';
import { ModelRegistryService } from '../../ai/models/model-registry.service';
import { drainToReturnValue } from '../../ai/streaming/drain-generator';
import { KnowledgeDocumentRepository } from '../documents/knowledge-document.repository';
import { KnowledgeIngestionService } from './knowledge-ingestion.service';

const BATCH_PER_TICK = 10;

/**
 * Re-embeds documents that were ingested while no AI provider was
 * available (KnowledgeDocument.embeddingsPendingAt). Each tick: skip
 * cheaply if embeddings still have no provider; otherwise reprocess a
 * bounded batch through the normal reindex pipeline, which re-embeds
 * from stored rawText and clears the pending flag on success.
 *
 * Runs outside any request, so tenant context is established per
 * document from the organization's oldest active membership — the same
 * borrowed-context pattern the workflow scheduler and integration poller
 * use for cron-driven tenant work.
 */
@Injectable()
export class KnowledgeEmbeddingBackfillService {
  private readonly logger = new Logger(KnowledgeEmbeddingBackfillService.name);
  private readonly embeddingProvider: AIProviderName;
  private readonly embeddingModel: string;
  private inFlight = false;

  constructor(
    private readonly knowledgeDocumentRepository: KnowledgeDocumentRepository,
    private readonly knowledgeIngestionService: KnowledgeIngestionService,
    private readonly modelRegistryService: ModelRegistryService,
    private readonly tenantContextService: TenantContextService,
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    this.embeddingProvider = configService.get<AIProviderName>(
      'knowledge.embeddingProvider',
      'openai',
    );
    this.embeddingModel = configService.get<string>(
      'knowledge.embeddingModel',
      'text-embedding-3-small',
    );
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async backfillPendingEmbeddings(): Promise<void> {
    if (this.inFlight) {
      return;
    }
    this.inFlight = true;
    try {
      await this.runOnce();
    } finally {
      this.inFlight = false;
    }
  }

  /** Extracted so tests (and operators via a REPL) can drive a single pass. */
  async runOnce(): Promise<{ processed: number; reembedded: number }> {
    const pending =
      await this.knowledgeDocumentRepository.listEmbeddingsPendingSystem(BATCH_PER_TICK);
    if (pending.length === 0) {
      return { processed: 0, reembedded: 0 };
    }

    if (!(await this.embeddingsAvailable())) {
      // Still no provider — leave the backlog untouched; no log spam
      // (this is the steady state until an operator adds a key).
      return { processed: 0, reembedded: 0 };
    }

    this.logger.log(
      { pendingCount: pending.length },
      'AI provider available — re-embedding documents indexed without vectors',
    );

    let reembedded = 0;
    for (const document of pending) {
      try {
        const membership = await this.prisma.system.membership.findFirst({
          where: { organizationId: document.organizationId, status: MembershipStatus.ACTIVE },
          orderBy: { joinedAt: 'asc' },
        });
        if (!membership) {
          this.logger.warn(
            { documentId: document.id, organizationId: document.organizationId },
            'Cannot backfill embeddings: organization has no active membership to run as',
          );
          continue;
        }

        const result = await this.tenantContextService.run(
          {
            organizationId: document.organizationId,
            userId: membership.userId,
            membershipId: membership.id,
            requestId: randomUUID(),
          },
          () => drainToReturnValue(this.knowledgeIngestionService.reindexDocument(document.id)),
        );

        if (result.status === 'INDEXED' && !result.embeddingsSkipped) {
          reembedded += 1;
        }
      } catch (error) {
        this.logger.error(
          { err: error, documentId: document.id },
          'Embedding backfill failed for document; will retry next tick',
        );
      }
    }

    return { processed: pending.length, reembedded };
  }

  private async embeddingsAvailable(): Promise<boolean> {
    try {
      await this.modelRegistryService.resolveProviderAndModel(
        this.embeddingProvider,
        this.embeddingModel,
        'embeddings',
      );
      return true;
    } catch {
      return false;
    }
  }
}
