import { Injectable } from '@nestjs/common';
import { estimateTokenCount } from '../chunking/text-chunker.service';
import { KnowledgeRetrievalService } from '../retrieval/knowledge-retrieval.service';
import {
  KnowledgeSearchOptions,
  KnowledgeSearchResult,
} from '../retrieval/knowledge-retrieval.types';
import { KnowledgeStreamEvent } from './knowledge-stream-event.types';

export interface KnowledgeContextResult {
  contextStrings: string[];
  citations: KnowledgeSearchResult['citation'][];
  confidence: number;
}

/**
 * The "Before every autonomous execution: retrieve -> rank -> compress ->
 * inject -> stream" pipeline. Retrieve/rank/compress all happen inside
 * KnowledgeRetrievalService.search (hybrid fusion, dedup, confidence,
 * token-budget compression) — this service's job is turning those results
 * into injectable context strings and streaming the lifecycle events, so
 * it has exactly two consumers: KnowledgeRetrieverService drains it
 * silently for automatic Gateway injection on every AI call, and
 * AgentLoopService re-yields its events into the agent-run SSE stream for
 * observability. No agent ever calls this directly.
 */
@Injectable()
export class KnowledgeContextBuilderService {
  constructor(private readonly knowledgeRetrievalService: KnowledgeRetrievalService) {}

  async *buildContext(
    query: string,
    options: KnowledgeSearchOptions = {},
    signal?: AbortSignal,
  ): AsyncGenerator<KnowledgeStreamEvent, KnowledgeContextResult> {
    yield { type: 'knowledge_searching', query };

    const results = await this.knowledgeRetrievalService.search(query, options, signal);

    yield { type: 'knowledge_ranking', candidateCount: results.length };

    const contextStrings = results.map(renderContextString);
    const tokenCount = contextStrings.reduce((sum, text) => sum + estimateTokenCount(text), 0);

    yield { type: 'knowledge_context_built', resultCount: results.length, tokenCount };

    const confidence =
      results.length > 0
        ? results.reduce((sum, result) => sum + result.confidence, 0) / results.length
        : 0;

    yield { type: 'knowledge_loaded', resultCount: results.length, confidence };

    const citations = results.map((result) => result.citation);
    yield {
      type: 'knowledge_citation_ready',
      citations: citations.map((citation) => ({
        sourceType: citation.sourceType,
        sourceName: citation.sourceName,
        documentTitle: citation.documentTitle,
        externalId: citation.externalId,
      })),
    };

    return { contextStrings, citations, confidence };
  }
}

function renderContextString(result: KnowledgeSearchResult): string {
  return `[${result.citation.sourceType}: ${result.citation.documentTitle}] ${result.content}`;
}
