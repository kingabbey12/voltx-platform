import { KnowledgeEvaluationService } from '../src/modules/knowledge/observability/knowledge-evaluation.service';
import { KnowledgeSearchResult } from '../src/modules/knowledge/retrieval/knowledge-retrieval.types';

describe('KnowledgeEvaluationService', () => {
  let retrievalService: { search: jest.Mock };

  function buildResult(
    chunkId: string,
    documentId: string,
    sourceId: string,
  ): KnowledgeSearchResult {
    return {
      chunkId,
      content: `content for ${chunkId}`,
      confidence: 0.8,
      semanticScore: 0.7,
      keywordScore: 0.6,
      citation: {
        sourceId,
        sourceType: 'DOCUMENT',
        sourceName: 'Runbooks',
        documentId,
        documentTitle: `Document ${documentId}`,
        externalId: null,
        chunkId,
        pageNumber: 1,
        confidence: 0.8,
        createdAt: new Date().toISOString(),
      },
    };
  }

  beforeEach(() => {
    retrievalService = {
      search: jest.fn(),
    };
  });

  it('returns zeroed metrics for an empty dataset', async () => {
    const service = new KnowledgeEvaluationService(retrievalService as never);
    const result = await service.evaluate([]);

    expect(result).toEqual({
      caseCount: 0,
      precisionAt5: 0,
      recallAt10: 0,
      mrr: 0,
      ndcgAt10: 0,
      citationAccuracy: 0,
      hallucinationRate: 0,
      contextPrecision: 0,
      averageRetrievalTimeMs: 0,
      averagePromptTokens: 0,
      averageCompletionTokens: 0,
    });
  });

  it('computes retrieval and citation metrics from labeled cases', async () => {
    retrievalService.search
      .mockResolvedValueOnce([
        buildResult('chunk-1', 'doc-1', 'source-1'),
        buildResult('chunk-2', 'doc-2', 'source-2'),
        buildResult('chunk-3', 'doc-3', 'source-3'),
      ])
      .mockResolvedValueOnce([
        buildResult('chunk-x', 'doc-x', 'source-x'),
        buildResult('chunk-y', 'doc-y', 'source-y'),
      ]);

    const service = new KnowledgeEvaluationService(retrievalService as never);
    const result = await service.evaluate([
      {
        query: 'How do we rotate API keys?',
        expectedChunkIds: ['chunk-1'],
        expectedDocumentIds: ['doc-1'],
        expectedCitationChunkIds: ['chunk-1'],
        promptTokens: 120,
        completionTokens: 60,
      },
      {
        query: 'How do we revoke old sessions?',
        expectedChunkIds: ['chunk-unknown'],
        promptTokens: 80,
        completionTokens: 20,
      },
    ]);

    expect(result.caseCount).toBe(2);
    expect(result.precisionAt5).toBeCloseTo(0.1, 5);
    expect(result.recallAt10).toBeCloseTo(0.25, 5);
    expect(result.mrr).toBeCloseTo(0.5, 5);
    expect(result.ndcgAt10).toBeGreaterThanOrEqual(0);
    expect(result.ndcgAt10).toBeLessThanOrEqual(1);
    expect(result.citationAccuracy).toBeCloseTo(1 / 6, 5);
    expect(result.hallucinationRate).toBeCloseTo(5 / 6, 5);
    expect(result.contextPrecision).toBeCloseTo(1 / 6, 5);
    expect(result.averagePromptTokens).toBe(100);
    expect(result.averageCompletionTokens).toBe(40);
    expect(retrievalService.search).toHaveBeenCalledTimes(2);
    expect(retrievalService.search).toHaveBeenNthCalledWith(1, 'How do we rotate API keys?', {
      topK: 10,
      minConfidence: 0,
    });
  });
});
