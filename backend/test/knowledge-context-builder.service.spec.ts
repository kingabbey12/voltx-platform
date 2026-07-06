import { KnowledgeContextBuilderService } from '../src/modules/knowledge/context/knowledge-context-builder.service';

function resultFixture(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    chunkId: 'chunk-1',
    content: 'Acme Corp is in the negotiation stage.',
    confidence: 0.8,
    semanticScore: 0.8,
    keywordScore: null,
    citation: {
      sourceId: 'source-1',
      sourceType: 'CRM_OPPORTUNITY',
      sourceName: 'Salesforce Opportunities',
      documentId: 'doc-1',
      documentTitle: 'Acme Corp Deal',
      externalId: 'sf-001',
    },
    ...overrides,
  };
}

async function drain<T, R>(generator: AsyncGenerator<T, R>): Promise<{ events: T[]; result: R }> {
  const events: T[] = [];
  let step = await generator.next();
  while (!step.done) {
    events.push(step.value);
    step = await generator.next();
  }
  return { events, result: step.value };
}

describe('KnowledgeContextBuilderService', () => {
  let retrievalService: { search: jest.Mock };

  function buildService(): KnowledgeContextBuilderService {
    return new KnowledgeContextBuilderService(retrievalService as never);
  }

  beforeEach(() => {
    retrievalService = { search: jest.fn().mockResolvedValue([]) };
  });

  it('streams the full lifecycle in order and returns context strings, citations, and confidence', async () => {
    retrievalService.search.mockResolvedValue([
      resultFixture(),
      resultFixture({
        chunkId: 'chunk-2',
        content: 'Support tickets are down 20%.',
        confidence: 0.4,
      }),
    ]);

    const service = buildService();
    const { events, result } = await drain(service.buildContext('deal status'));

    expect(events.map((e) => e.type)).toEqual([
      'knowledge_searching',
      'knowledge_ranking',
      'knowledge_context_built',
      'knowledge_loaded',
      'knowledge_citation_ready',
    ]);

    expect(result.contextStrings).toHaveLength(2);
    expect(result.contextStrings[0]).toContain('CRM_OPPORTUNITY');
    expect(result.contextStrings[0]).toContain('Acme Corp is in the negotiation stage.');
    expect(result.citations).toHaveLength(2);
    expect(result.confidence).toBeCloseTo(0.6, 5);
  });

  it('passes query and options straight through to the retrieval service', async () => {
    const service = buildService();
    await drain(service.buildContext('deal status', { topK: 3, minConfidence: 0.5 }));

    expect(retrievalService.search).toHaveBeenCalledWith(
      'deal status',
      { topK: 3, minConfidence: 0.5 },
      undefined,
    );
  });

  it('reports zero confidence and empty citations when nothing is retrieved', async () => {
    const service = buildService();
    const { result } = await drain(service.buildContext('no matches'));

    expect(result).toEqual({ contextStrings: [], citations: [], confidence: 0 });
  });

  it('forwards an abort signal to the retrieval service', async () => {
    const controller = new AbortController();
    const service = buildService();
    await drain(service.buildContext('deal status', {}, controller.signal));

    expect(retrievalService.search).toHaveBeenCalledWith('deal status', {}, controller.signal);
  });
});
