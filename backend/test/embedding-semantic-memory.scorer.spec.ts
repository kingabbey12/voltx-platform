import { AIGatewayService } from '../src/modules/ai/gateway/ai-gateway.service';
import { EmbeddingSemanticMemoryScorer } from '../src/modules/ai/memory/embedding-semantic-memory.scorer';
import { MemoryEntity } from '../src/modules/ai/memory/entities/memory.entity';
import { MemoryRepository } from '../src/modules/ai/memory/memory.repository';

function buildMemory(overrides: Partial<MemoryEntity> = {}): MemoryEntity {
  return {
    id: 'memory-1',
    organizationId: 'org-1',
    userId: 'user-1',
    conversationId: 'conversation-1',
    category: 'general',
    importance: 0.5,
    content: 'test',
    embeddingId: null,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    ...overrides,
  };
}

describe('EmbeddingSemanticMemoryScorer', () => {
  let aiGatewayService: jest.Mocked<AIGatewayService>;
  let memoryRepository: jest.Mocked<MemoryRepository>;
  let scorer: EmbeddingSemanticMemoryScorer;

  beforeEach(() => {
    aiGatewayService = {
      embeddings: jest.fn(),
    } as unknown as jest.Mocked<AIGatewayService>;
    memoryRepository = {
      getEmbeddingForMemory: jest.fn(),
    } as unknown as jest.Mocked<MemoryRepository>;
    scorer = new EmbeddingSemanticMemoryScorer(aiGatewayService, memoryRepository);
  });

  it('scores 1 for identical embeddings', async () => {
    aiGatewayService.embeddings.mockResolvedValue({
      provider: 'openai',
      model: 'text-embedding-3-small',
      vectors: [[1, 0, 0]],
    } as never);
    memoryRepository.getEmbeddingForMemory.mockResolvedValue([1, 0, 0]);

    const score = await scorer.score('query', buildMemory());
    expect(score).toBeCloseTo(1, 5);
  });

  it('scores 0 for orthogonal embeddings', async () => {
    aiGatewayService.embeddings.mockResolvedValue({
      provider: 'openai',
      model: 'text-embedding-3-small',
      vectors: [[1, 0, 0]],
    } as never);
    memoryRepository.getEmbeddingForMemory.mockResolvedValue([0, 1, 0]);

    const score = await scorer.score('query', buildMemory());
    expect(score).toBeCloseTo(0, 5);
  });

  it('returns 0 when the memory has no stored embedding', async () => {
    aiGatewayService.embeddings.mockResolvedValue({
      provider: 'openai',
      model: 'text-embedding-3-small',
      vectors: [[1, 0, 0]],
    } as never);
    memoryRepository.getEmbeddingForMemory.mockResolvedValue(null);

    const score = await scorer.score('query', buildMemory());
    expect(score).toBe(0);
  });

  it('returns 0 and never calls the embeddings API for an empty query', async () => {
    const score = await scorer.score('   ', buildMemory());
    expect(score).toBe(0);
    expect(aiGatewayService.embeddings).not.toHaveBeenCalled();
  });

  it('coalesces concurrent scoring calls for the same query into a single embeddings call', async () => {
    aiGatewayService.embeddings.mockResolvedValue({
      provider: 'openai',
      model: 'text-embedding-3-small',
      vectors: [[1, 0, 0]],
    } as never);
    memoryRepository.getEmbeddingForMemory.mockResolvedValue([1, 0, 0]);

    await Promise.all([
      scorer.score('same query', buildMemory({ id: 'memory-1' })),
      scorer.score('same query', buildMemory({ id: 'memory-2' })),
      scorer.score('same query', buildMemory({ id: 'memory-3' })),
    ]);

    expect(aiGatewayService.embeddings).toHaveBeenCalledTimes(1);
  });

  it('never throws when the embeddings call fails, scoring 0 instead', async () => {
    aiGatewayService.embeddings.mockRejectedValue(new Error('provider unavailable'));
    memoryRepository.getEmbeddingForMemory.mockResolvedValue([1, 0, 0]);

    const score = await scorer.score('query', buildMemory());
    expect(score).toBe(0);
  });
});
