import { Test, TestingModule } from '@nestjs/testing';
import {
  MemoryScorer,
  NoopSemanticMemoryScorer,
  SEMANTIC_MEMORY_SCORER,
} from '../src/modules/ai/memory/memory.scorer';

describe('MemoryScorer', () => {
  let scorer: MemoryScorer;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MemoryScorer,
        NoopSemanticMemoryScorer,
        {
          provide: SEMANTIC_MEMORY_SCORER,
          useExisting: NoopSemanticMemoryScorer,
        },
      ],
    }).compile();

    scorer = module.get(MemoryScorer);
  });

  it('scores recent and lexically relevant memories higher', async () => {
    const score = await scorer.score({
      query: 'preferred deployment window at 2 AM UTC',
      memory: {
        id: 'memory-1',
        organizationId: 'org-1',
        userId: 'user-1',
        conversationId: 'conversation-1',
        category: 'preference',
        importance: 0.9,
        content: 'My preferred deployment window is 2 AM UTC.',
        embeddingId: null,
        metadata: {},
        createdAt: new Date('2026-07-03T00:00:00.000Z'),
        updatedAt: new Date('2026-07-04T00:00:00.000Z'),
        deletedAt: null,
      },
      now: new Date('2026-07-04T01:00:00.000Z'),
    });

    expect(score.importance).toBeCloseTo(0.9);
    expect(score.lexical).toBeGreaterThan(0.5);
    expect(score.total).toBeGreaterThan(0.6);
  });
});
