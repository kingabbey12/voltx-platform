import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { KnowledgeContextBuilderService } from '../../knowledge/context/knowledge-context-builder.service';
import { KnowledgeCitation } from '../../knowledge/retrieval/knowledge-retrieval.types';

export interface KnowledgeRetrievalRequest {
  organizationId: string;
  query: string;
  limit?: number;
}

/**
 * Retrieves knowledge-base context strings relevant to a query, for
 * injection into the AI Gateway's workspace context alongside memories.
 */
export interface KnowledgeRetriever {
  retrieve(request: KnowledgeRetrievalRequest): Promise<string[]>;
  retrieveWithCitations(request: KnowledgeRetrievalRequest): Promise<{
    contextStrings: string[];
    citations: KnowledgeCitation[];
    confidence: number;
  }>;
}

/**
 * Real implementation backed by the Enterprise Knowledge Graph & RAG
 * platform (KnowledgeContextBuilderService: hybrid retrieve -> rank ->
 * compress). `organizationId` on the request is not used directly —
 * KnowledgeContextBuilderService's repositories read the same tenant
 * context (AsyncLocalStorage) every other repository in this codebase
 * does, which is already guaranteed set by the time a request reaches
 * AIGatewayService. Retrieval failures are swallowed (logged, empty
 * result) so a knowledge-layer problem — no provider configured, a
 * transient DB error — never breaks the underlying chat/agent call this
 * context was going to enrich; this preserves the exact fallback
 * behavior of the previous null-object implementation.
 */
@Injectable()
export class KnowledgeRetrieverService implements KnowledgeRetriever {
  private readonly logger = new Logger(KnowledgeRetrieverService.name);

  constructor(
    @Inject(forwardRef(() => KnowledgeContextBuilderService))
    private readonly knowledgeContextBuilderService: KnowledgeContextBuilderService,
  ) {}

  async retrieve(request: KnowledgeRetrievalRequest): Promise<string[]> {
    const result = await this.retrieveWithCitations(request);
    return result.contextStrings;
  }

  async retrieveWithCitations(request: KnowledgeRetrievalRequest): Promise<{
    contextStrings: string[];
    citations: KnowledgeCitation[];
    confidence: number;
  }> {
    try {
      const generator = this.knowledgeContextBuilderService.buildContext(request.query, {
        topK: request.limit,
      });

      let step = await generator.next();
      while (!step.done) {
        step = await generator.next();
      }

      return step.value;
    } catch (error) {
      this.logger.warn({ err: error }, 'Knowledge retrieval failed; continuing without context');
      return { contextStrings: [], citations: [], confidence: 0 };
    }
  }
}
