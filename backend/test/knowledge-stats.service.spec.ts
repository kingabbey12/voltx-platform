import { KnowledgeStatsService } from '../src/modules/knowledge/observability/knowledge-stats.service';

describe('KnowledgeStatsService', () => {
  let sourceRepository: { countForOrganization: jest.Mock };
  let documentRepository: { countForOrganization: jest.Mock };
  let chunkRepository: { countForOrganization: jest.Mock };
  let graphService: { stats: jest.Mock };
  let searchLogRepository: { summarize: jest.Mock };
  let aiUsageService: { summarizeByRequestType: jest.Mock };
  let tenantContextService: { getOrThrow: jest.Mock };

  function buildService(): KnowledgeStatsService {
    return new KnowledgeStatsService(
      sourceRepository as never,
      documentRepository as never,
      chunkRepository as never,
      graphService as never,
      searchLogRepository as never,
      aiUsageService as never,
      tenantContextService as never,
    );
  }

  beforeEach(() => {
    sourceRepository = { countForOrganization: jest.fn().mockResolvedValue(2) };
    documentRepository = { countForOrganization: jest.fn().mockResolvedValue(10) };
    chunkRepository = { countForOrganization: jest.fn().mockResolvedValue(100) };
    graphService = { stats: jest.fn().mockResolvedValue({ entityCount: 5, relationshipCount: 8 }) };
    searchLogRepository = {
      summarize: jest.fn().mockResolvedValue({
        searchCount: 20,
        averageLatencyMs: 150,
        cacheHitRate: 0.25,
        averageConfidence: 0.7,
        hitRate: 0.9,
      }),
    };
    aiUsageService = {
      summarizeByRequestType: jest.fn().mockResolvedValue({
        callCount: 12,
        totalTokens: 500,
        totalCostUsd: 0.02,
        totalDurationMs: 1200,
      }),
    };
    tenantContextService = { getOrThrow: jest.fn().mockReturnValue({ organizationId: 'org-1' }) };
  });

  it('aggregates index size, embedding, and retrieval stats from their respective sources', async () => {
    const service = buildService();
    const stats = await service.getStats();

    expect(stats.indexSize).toEqual({
      sourceCount: 2,
      documentCount: 10,
      chunkCount: 100,
      entityCount: 5,
      relationshipCount: 8,
    });
    expect(stats.embedding).toEqual({ callCount: 12, averageLatencyMs: 100, totalCostUsd: 0.02 });
    expect(stats.retrieval).toEqual({
      searchCount: 20,
      averageLatencyMs: 150,
      hitRate: 0.9,
      cacheHitRate: 0.25,
      averageConfidence: 0.7,
    });
    expect(aiUsageService.summarizeByRequestType).toHaveBeenCalledWith(
      'org-1',
      'KNOWLEDGE_EMBEDDING',
      expect.any(Number),
    );
  });

  it('reports zero average embedding latency when there have been no embedding calls', async () => {
    aiUsageService.summarizeByRequestType.mockResolvedValue({
      callCount: 0,
      totalTokens: 0,
      totalCostUsd: 0,
      totalDurationMs: 0,
    });

    const service = buildService();
    const stats = await service.getStats();

    expect(stats.embedding.averageLatencyMs).toBe(0);
  });

  it('reports healthy when chunks exist and hit rate is acceptable', async () => {
    const service = buildService();
    const health = await service.getHealth();

    expect(health).toEqual({ healthy: true, reasons: [] });
  });

  it('flags unhealthy when there are no indexed chunks yet', async () => {
    chunkRepository.countForOrganization.mockResolvedValue(0);

    const service = buildService();
    const health = await service.getHealth();

    expect(health.healthy).toBe(false);
    expect(health.reasons).toContain('No indexed knowledge chunks yet');
  });

  it('flags unhealthy when retrieval hit rate is low despite having search volume', async () => {
    searchLogRepository.summarize.mockResolvedValue({
      searchCount: 50,
      averageLatencyMs: 200,
      cacheHitRate: 0.1,
      averageConfidence: 0.3,
      hitRate: 0.05,
    });

    const service = buildService();
    const health = await service.getHealth();

    expect(health.healthy).toBe(false);
    expect(health.reasons.some((reason) => reason.includes('hit rate'))).toBe(true);
  });
});
