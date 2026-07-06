export type KnowledgeStreamEvent =
  | { type: 'knowledge_searching'; query: string }
  | { type: 'knowledge_ranking'; candidateCount: number }
  | { type: 'knowledge_context_built'; resultCount: number; tokenCount: number }
  | { type: 'knowledge_loaded'; resultCount: number; confidence: number }
  | {
      type: 'knowledge_citation_ready';
      citations: Array<{
        sourceType: string;
        sourceName: string;
        documentTitle: string;
        externalId: string | null;
      }>;
    };
