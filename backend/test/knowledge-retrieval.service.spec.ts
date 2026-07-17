import { InMemoryEmbeddingCache } from '../src/modules/knowledge/retrieval/embedding-cache';
import { KnowledgeRetrievalService } from '../src/modules/knowledge/retrieval/knowledge-retrieval.service';

function buildHit(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'chunk-1',
    organizationId: 'org-1',
    documentId: 'doc-1',
    chunkIndex: 0,
    content: 'Acme Corp is in the negotiation stage.',
    tokenCount: 8,
    metadata: {},
    createdAt: new Date(),
    deletedAt: null,
    documentTitle: 'Acme Corp Deal',
    documentContentType: 'text',
    sourceId: 'source-1',
    sourceType: 'CRM_OPPORTUNITY',
    sourceName: 'Salesforce Opportunities',
    externalId: 'sf-001',
    ...overrides,
  };
}

function configServiceWithDefaults(overrides: Record<string, unknown> = {}) {
  const defaults: Record<string, unknown> = {
    'knowledge.embeddingProvider': 'openai',
    'knowledge.embeddingModel': 'text-embedding-3-small',
    'knowledge.retrieval.defaultTopK': 8,
    'knowledge.retrieval.maxTopK': 50,
    'knowledge.retrieval.semanticWeight': 0.65,
    'knowledge.retrieval.keywordWeight': 0.35,
    'knowledge.retrieval.minConfidence': 0.15,
    'knowledge.retrieval.contextTokenBudget': 2000,
    'knowledge.retrieval.cacheTtlMs': 30000,
    ...overrides,
  };
  return {
    get: jest.fn((key: string, defaultValue: unknown) => defaults[key] ?? defaultValue),
  } as never;
}

describe('KnowledgeRetrievalService', () => {
  let chunkRepository: { semanticSearch: jest.Mock; keywordSearch: jest.Mock };
  let aiGatewayService: { embeddings: jest.Mock };
  let searchLogRepository: { create: jest.Mock };
  let embeddingCache: InMemoryEmbeddingCache;

  function buildService(configOverrides: Record<string, unknown> = {}): KnowledgeRetrievalService {
    return new KnowledgeRetrievalService(
      chunkRepository as never,
      aiGatewayService as never,
      searchLogRepository as never,
      embeddingCache,
      configServiceWithDefaults(configOverrides),
    );
  }

  beforeEach(() => {
    chunkRepository = {
      semanticSearch: jest.fn().mockResolvedValue([]),
      keywordSearch: jest.fn().mockResolvedValue([]),
    };
    aiGatewayService = {
      embeddings: jest.fn().mockResolvedValue({
        provider: 'openai',
        model: 'text-embedding-3-small',
        vectors: [[0.1, 0.2, 0.3]],
      }),
    };
    searchLogRepository = { create: jest.fn().mockResolvedValue(undefined) };
    embeddingCache = new InMemoryEmbeddingCache();
  });

  it('returns no results and makes no calls for an empty query', async () => {
    const service = buildService();
    const results = await service.search('   ');

    expect(results).toEqual([]);
    expect(aiGatewayService.embeddings).not.toHaveBeenCalled();
    expect(chunkRepository.semanticSearch).not.toHaveBeenCalled();
  });

  it('ranks a semantic-only hit with a positive confidence', async () => {
    chunkRepository.semanticSearch.mockResolvedValue([{ ...buildHit(), similarity: 0.9 }]);

    const service = buildService();
    const results = await service.search('Acme deal status');

    expect(results).toHaveLength(1);
    expect(results[0].semanticScore).toBe(0.9);
    expect(results[0].keywordScore).toBeNull();
    expect(results[0].confidence).toBeGreaterThan(0);
    expect(results[0].citation.sourceName).toBe('Salesforce Opportunities');
  });

  it('merges a chunk appearing in both semantic and keyword results into a single, higher-confidence result', async () => {
    chunkRepository.semanticSearch.mockResolvedValue([
      { ...buildHit({ id: 'chunk-shared' }), similarity: 0.8 },
    ]);
    chunkRepository.keywordSearch.mockResolvedValue([
      { ...buildHit({ id: 'chunk-shared' }), rank: 0.3 },
    ]);

    const service = buildService();
    const results = await service.search('Acme deal status');

    expect(results).toHaveLength(1);
    expect(results[0].semanticScore).toBe(0.8);
    expect(results[0].keywordScore).toBe(0.3);
  });

  it('keeps semantic-only and keyword-only hits as separate results when they reference different chunks', async () => {
    chunkRepository.semanticSearch.mockResolvedValue([
      { ...buildHit({ id: 'chunk-a' }), similarity: 0.9 },
    ]);
    chunkRepository.keywordSearch.mockResolvedValue([
      { ...buildHit({ id: 'chunk-b', content: 'Different chunk entirely.' }), rank: 5 },
    ]);

    const service = buildService();
    const results = await service.search('Acme deal status');

    expect(results.map((r) => r.chunkId).sort()).toEqual(['chunk-a', 'chunk-b']);
  });

  it('filters out results below the configured minConfidence', async () => {
    chunkRepository.semanticSearch.mockResolvedValue([{ ...buildHit(), similarity: 0.001 }]);

    const service = buildService({ 'knowledge.retrieval.minConfidence': 0.5 });
    const results = await service.search('irrelevant query');

    expect(results).toEqual([]);
  });

  it('deduplicates results whose content is identical after normalization', async () => {
    chunkRepository.semanticSearch.mockResolvedValue([
      { ...buildHit({ id: 'chunk-a', content: 'Same fact, stated once.' }), similarity: 0.9 },
      {
        ...buildHit({ id: 'chunk-b', content: '  same FACT,   stated once.  ' }),
        similarity: 0.85,
      },
    ]);

    const service = buildService();
    const results = await service.search('same fact');

    expect(results).toHaveLength(1);
  });

  it('compresses results to fit the context token budget, truncating the boundary result', async () => {
    const longContent = Array.from({ length: 500 }, (_, i) => `word${i}`).join(' ');
    chunkRepository.semanticSearch.mockResolvedValue([
      { ...buildHit({ id: 'chunk-a', content: longContent }), similarity: 0.95 },
      { ...buildHit({ id: 'chunk-b', content: longContent }), similarity: 0.9 },
    ]);

    const service = buildService({ 'knowledge.retrieval.contextTokenBudget': 100 });
    const results = await service.search('long content query');

    const totalWords = results.reduce((sum, r) => sum + r.content.split(/\s+/).length, 0);
    expect(totalWords).toBeLessThan(1000);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('caches the query embedding within the TTL window, skipping a second embeddings call', async () => {
    chunkRepository.semanticSearch.mockResolvedValue([{ ...buildHit(), similarity: 0.9 }]);

    const service = buildService({ 'knowledge.retrieval.cacheTtlMs': 60000 });
    await service.search('repeated query');
    await service.search('repeated query');

    expect(aiGatewayService.embeddings).toHaveBeenCalledTimes(1);
  });

  it('degrades gracefully to semantic-only results when keyword search fails', async () => {
    chunkRepository.semanticSearch.mockResolvedValue([{ ...buildHit(), similarity: 0.9 }]);
    chunkRepository.keywordSearch.mockRejectedValue(new Error('tsquery syntax error'));

    const service = buildService();
    const results = await service.search('bad && query');

    expect(results).toHaveLength(1);
    expect(results[0].keywordScore).toBeNull();
  });

  it('logs every search with result count and confidence, without throwing on log failure', async () => {
    chunkRepository.semanticSearch.mockResolvedValue([{ ...buildHit(), similarity: 0.9 }]);
    searchLogRepository.create.mockRejectedValue(new Error('log db down'));

    const service = buildService();
    const results = await service.search('Acme deal status');

    expect(results).toHaveLength(1);
    // Fire-and-forget: give the microtask queue a tick to observe the call was attempted.
    await Promise.resolve();
    expect(searchLogRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ query: 'Acme deal status', resultCount: 1 }),
    );
  });

  it('falls back to keyword-only search when no AI provider is available for query embedding', async () => {
    const { ServiceUnavailableException } = await import('@nestjs/common');
    aiGatewayService.embeddings.mockRejectedValue(
      new ServiceUnavailableException('No AI providers are enabled'),
    );
    chunkRepository.keywordSearch.mockResolvedValue([{ ...buildHit(), rank: 0.9 }]);

    const service = buildService();
    const results = await service.search('Acme deal status');

    // Search still returns the lexical hit instead of throwing…
    expect(results).toHaveLength(1);
    expect(results[0].content).toContain('Acme Corp');
    // …and the semantic leg was skipped entirely (no vector to search with).
    expect(chunkRepository.semanticSearch).not.toHaveBeenCalled();
  });

  it('still throws for non-availability embedding failures', async () => {
    aiGatewayService.embeddings.mockRejectedValue(new Error('rate limited'));

    const service = buildService();
    await expect(service.search('Acme deal status')).rejects.toThrow('rate limited');
  });
});
