import { KnowledgeIngestionService } from '../src/modules/knowledge/ingestion/knowledge-ingestion.service';

function configServiceWithDefaults(overrides: Record<string, unknown> = {}) {
  const defaults: Record<string, unknown> = {
    'knowledge.embeddingProvider': 'openai',
    'knowledge.embeddingModel': 'text-embedding-3-small',
    'knowledge.embeddingDimensions': 3,
    'knowledge.embeddingBatchSize': 2,
    ...overrides,
  };
  return {
    get: jest.fn((key: string, defaultValue: unknown) => defaults[key] ?? defaultValue),
  } as never;
}

function documentFixture(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'doc-1',
    organizationId: 'org-1',
    sourceId: 'source-1',
    externalId: null,
    title: 'Doc',
    contentType: 'text',
    rawText: null,
    metadata: {},
    status: 'PENDING',
    indexedAt: null,
    error: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
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

describe('KnowledgeIngestionService', () => {
  let documentRepository: {
    create: jest.Mock;
    findById: jest.Mock;
    findBySourceAndExternalId: jest.Mock;
    update: jest.Mock;
    listBySource: jest.Mock;
  };
  let chunkRepository: {
    deleteByDocument: jest.Mock;
    createMany: jest.Mock;
    findEmbeddingsByChecksum: jest.Mock;
  };
  let sourceRepository: { markIndexed: jest.Mock };
  let textExtractorRegistry: { extract: jest.Mock };
  let textChunkerService: { chunk: jest.Mock };
  let aiGatewayService: { embeddings: jest.Mock };

  function buildService(configOverrides: Record<string, unknown> = {}): KnowledgeIngestionService {
    return new KnowledgeIngestionService(
      documentRepository as never,
      chunkRepository as never,
      sourceRepository as never,
      textExtractorRegistry as never,
      textChunkerService as never,
      aiGatewayService as never,
      configServiceWithDefaults(configOverrides),
    );
  }

  beforeEach(() => {
    documentRepository = {
      create: jest.fn().mockResolvedValue(documentFixture()),
      findById: jest.fn().mockResolvedValue(documentFixture({ rawText: 'stored extracted text' })),
      findBySourceAndExternalId: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue(documentFixture()),
      listBySource: jest.fn().mockResolvedValue([]),
    };
    chunkRepository = {
      deleteByDocument: jest.fn().mockResolvedValue(0),
      createMany: jest.fn().mockResolvedValue([]),
      findEmbeddingsByChecksum: jest.fn().mockResolvedValue(new Map()),
    };
    sourceRepository = { markIndexed: jest.fn().mockResolvedValue(undefined) };
    textExtractorRegistry = {
      extract: jest.fn().mockResolvedValue('Extracted plain text content.'),
    };
    textChunkerService = {
      chunk: jest.fn().mockReturnValue([
        { index: 0, content: 'chunk one', tokenCount: 2 },
        { index: 1, content: 'chunk two', tokenCount: 2 },
      ]),
    };
    aiGatewayService = {
      embeddings: jest.fn().mockResolvedValue({
        provider: 'openai',
        model: 'text-embedding-3-small',
        vectors: [
          [0.1, 0.2, 0.3],
          [0.4, 0.5, 0.6],
        ],
      }),
    };
  });

  it('ingests a document end-to-end: extracts, chunks, embeds, stores, and marks INDEXED', async () => {
    const service = buildService();
    const { events, result } = await drain(
      service.ingestDocument({
        sourceId: 'source-1',
        title: 'Doc',
        contentType: 'text',
        text: 'raw',
      }),
    );

    expect(result).toEqual({ documentId: 'doc-1', status: 'INDEXED', chunkCount: 2 });
    expect(events.map((e) => e.type)).toEqual([
      'indexing_started',
      'text_extracted',
      'chunking_completed',
      'embedding_started',
      'embedding_completed',
      'indexing_completed',
    ]);
    expect(chunkRepository.createMany).toHaveBeenCalledWith([
      expect.objectContaining({ chunkIndex: 0, embedding: [0.1, 0.2, 0.3] }),
      expect.objectContaining({ chunkIndex: 1, embedding: [0.4, 0.5, 0.6] }),
    ]);
    expect(documentRepository.update).toHaveBeenCalledWith(
      'doc-1',
      expect.objectContaining({ status: 'INDEXED' }),
    );
    expect(sourceRepository.markIndexed).toHaveBeenCalledWith('source-1');
  });

  it('re-ingests in place (updates the existing document) when externalId already exists for the source', async () => {
    documentRepository.findBySourceAndExternalId.mockResolvedValue(
      documentFixture({ id: 'doc-existing' }),
    );
    documentRepository.update.mockResolvedValue(documentFixture({ id: 'doc-existing' }));

    const service = buildService();
    await drain(
      service.ingestDocument({
        sourceId: 'source-1',
        externalId: 'crm-123',
        title: 'Updated title',
        contentType: 'text',
        text: 'raw',
      }),
    );

    expect(documentRepository.create).not.toHaveBeenCalled();
    expect(chunkRepository.deleteByDocument).toHaveBeenCalledWith('doc-existing');
  });

  it('clears prior chunks before re-storing new ones, so reindexing never leaves stale chunks', async () => {
    const service = buildService();
    await drain(
      service.ingestDocument({
        sourceId: 'source-1',
        title: 'Doc',
        contentType: 'text',
        text: 'raw',
      }),
    );

    expect(chunkRepository.deleteByDocument).toHaveBeenCalledWith('doc-1');
    expect(chunkRepository.deleteByDocument.mock.invocationCallOrder[0]).toBeLessThan(
      chunkRepository.createMany.mock.invocationCallOrder[0],
    );
  });

  it('marks the document FAILED and reports failure instead of throwing when extraction fails', async () => {
    textExtractorRegistry.extract.mockRejectedValue(new Error('corrupt file'));

    const service = buildService();
    const { events, result } = await drain(
      service.ingestDocument({
        sourceId: 'source-1',
        title: 'Doc',
        contentType: 'pdf',
        buffer: Buffer.from('x'),
      }),
    );

    expect(result).toEqual({
      documentId: 'doc-1',
      status: 'FAILED',
      chunkCount: 0,
      error: 'corrupt file',
    });
    expect(events.some((e) => e.type === 'indexing_failed')).toBe(true);
    expect(documentRepository.update).toHaveBeenCalledWith(
      'doc-1',
      expect.objectContaining({ status: 'FAILED', error: 'corrupt file' }),
    );
  });

  it('rejects when the embedding model returns vectors of the wrong dimensionality', async () => {
    aiGatewayService.embeddings.mockResolvedValue({
      provider: 'openai',
      model: 'text-embedding-3-small',
      vectors: [
        [0.1, 0.2],
        [0.3, 0.4],
      ],
    });

    const service = buildService();
    const { result } = await drain(
      service.ingestDocument({
        sourceId: 'source-1',
        title: 'Doc',
        contentType: 'text',
        text: 'raw',
      }),
    );

    expect(result.status).toBe('FAILED');
    expect(result.error).toContain('expected 3');
  });

  it('batches embedding calls according to the configured batch size', async () => {
    textChunkerService.chunk.mockReturnValue([
      { index: 0, content: 'a', tokenCount: 1 },
      { index: 1, content: 'b', tokenCount: 1 },
      { index: 2, content: 'c', tokenCount: 1 },
    ]);
    aiGatewayService.embeddings.mockResolvedValue({
      provider: 'openai',
      model: 'text-embedding-3-small',
      vectors: [
        [0.1, 0.1, 0.1],
        [0.2, 0.2, 0.2],
      ],
    });

    const service = buildService({ 'knowledge.embeddingBatchSize': 2 });
    await drain(
      service.ingestDocument({
        sourceId: 'source-1',
        title: 'Doc',
        contentType: 'text',
        text: 'raw',
      }),
    );

    expect(aiGatewayService.embeddings).toHaveBeenCalledTimes(2);
    const calls = aiGatewayService.embeddings.mock.calls as Array<[{ input: string[] }]>;
    expect(calls[0][0].input).toEqual(['a', 'b']);
    expect(calls[1][0].input).toEqual(['c']);
  });

  it('produces zero chunks without calling embeddings when the extracted text is empty', async () => {
    textExtractorRegistry.extract.mockResolvedValue('');
    textChunkerService.chunk.mockReturnValue([]);

    const service = buildService();
    const { result } = await drain(
      service.ingestDocument({ sourceId: 'source-1', title: 'Doc', contentType: 'text', text: '' }),
    );

    expect(result).toEqual({ documentId: 'doc-1', status: 'INDEXED', chunkCount: 0 });
    expect(aiGatewayService.embeddings).not.toHaveBeenCalled();
  });

  it('reindexDocument re-chunks and re-embeds from stored rawText without needing the original file', async () => {
    const service = buildService();
    const { result } = await drain(service.reindexDocument('doc-1'));

    expect(result).toEqual({ documentId: 'doc-1', status: 'INDEXED', chunkCount: 2 });
    expect(textExtractorRegistry.extract).not.toHaveBeenCalled();
    expect(textChunkerService.chunk).toHaveBeenCalledWith('stored extracted text');
  });

  it('reindexDocument fails gracefully when the document has no stored extracted text', async () => {
    documentRepository.findById.mockResolvedValue(documentFixture({ rawText: null }));

    const service = buildService();
    const { result } = await drain(service.reindexDocument('doc-1'));

    expect(result.status).toBe('FAILED');
    expect(result.error).toContain('no stored extracted text');
  });

  it('reindexSource reindexes every document under the source and continues past a single failure', async () => {
    documentRepository.listBySource.mockResolvedValue([
      documentFixture({ id: 'doc-a', rawText: 'text a' }),
      documentFixture({ id: 'doc-b', rawText: null }),
      documentFixture({ id: 'doc-c', rawText: 'text c' }),
    ]);
    documentRepository.findById.mockImplementation((id: string) =>
      Promise.resolve(
        [
          documentFixture({ id: 'doc-a', rawText: 'text a' }),
          documentFixture({ id: 'doc-b', rawText: null }),
          documentFixture({ id: 'doc-c', rawText: 'text c' }),
        ].find((doc) => doc.id === id) ?? null,
      ),
    );

    const service = buildService();
    const { result } = await drain(service.reindexSource('source-1'));

    expect(result).toHaveLength(3);
    expect(result.map((r) => r.status)).toEqual(['INDEXED', 'FAILED', 'INDEXED']);
  });
});
