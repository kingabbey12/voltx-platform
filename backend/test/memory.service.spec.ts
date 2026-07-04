import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from '../src/modules/audit/audit.service';
import { TenantContextService } from '../src/common/tenant/tenant-context.service';
import { MemoryRepository } from '../src/modules/ai/memory/memory.repository';
import { MemorySelector } from '../src/modules/ai/memory/memory.selector';
import { MemoryService } from '../src/modules/ai/memory/memory.service';

describe('MemoryService', () => {
  let service: MemoryService;
  let repository: jest.Mocked<MemoryRepository>;
  let selector: jest.Mocked<MemorySelector>;
  let tenantContextService: jest.Mocked<TenantContextService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MemoryService,
        {
          provide: MemoryRepository,
          useValue: {
            listMemories: jest.fn(),
            createMemory: jest.fn(),
            softDeleteMemory: jest.fn(),
            conversationExists: jest.fn(),
            countActiveMemories: jest.fn().mockResolvedValue(1),
            listPrunableMemories: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: MemorySelector,
          useValue: {
            select: jest.fn(),
          },
        },
        {
          provide: TenantContextService,
          useValue: {
            isComplete: jest.fn().mockReturnValue(true),
          },
        },
        {
          provide: AuditService,
          useValue: {
            record: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get(MemoryService);
    repository = module.get(MemoryRepository);
    selector = module.get(MemorySelector);
    tenantContextService = module.get(TenantContextService);
  });

  it('creates a manual memory when the conversation is accessible', async () => {
    repository.conversationExists.mockResolvedValue(true);
    repository.createMemory.mockResolvedValue({
      id: 'memory-1',
      organizationId: 'org-1',
      userId: 'user-1',
      conversationId: 'conversation-1',
      category: 'preference',
      importance: 0.9,
      content: 'Remember that my preferred deployment window is 2 AM UTC.',
      embeddingId: null,
      metadata: { source: 'manual' },
      createdAt: new Date('2026-07-04T00:00:00.000Z'),
      updatedAt: new Date('2026-07-04T00:00:00.000Z'),
      deletedAt: null,
    });

    const result = await service.createMemory({
      conversationId: 'conversation-1',
      category: 'preference',
      content: 'Remember that my preferred deployment window is 2 AM UTC.',
    });

    expect(result.category).toBe('preference');
    expect(repository.createMemory).toHaveBeenCalled();
  });

  it('returns relevant memories for completions with tenant context', async () => {
    repository.conversationExists.mockResolvedValue(true);
    selector.select.mockResolvedValue([
      {
        memory: {
          id: 'memory-1',
          organizationId: 'org-1',
          userId: 'user-1',
          conversationId: 'conversation-1',
          category: 'preference',
          importance: 0.8,
          content: 'User prefers deployment windows at 2 AM UTC.',
          embeddingId: null,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          deletedAt: null,
        },
        score: {
          importance: 0.8,
          recency: 0.8,
          lexical: 0.8,
          semantic: 0,
          total: 0.72,
        },
      },
    ]);

    const result = await service.selectRelevantMemoriesForCompletion({
      conversationId: 'conversation-1',
      userPrompt: 'When should I deploy?',
    });

    expect(result).toHaveLength(1);
    expect(selector.select).toHaveBeenCalled();
  });

  it('throws when deleting an unknown memory', async () => {
    repository.softDeleteMemory.mockResolvedValue(null);

    await expect(service.deleteMemory('missing-memory')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('captures important conversation memories automatically', async () => {
    repository.conversationExists.mockResolvedValue(true);
    repository.createMemory.mockResolvedValue({
      id: 'memory-1',
      organizationId: 'org-1',
      userId: 'user-1',
      conversationId: 'conversation-1',
      category: 'preference',
      importance: 0.88,
      content: 'Remember that my preferred deployment window is 2 AM UTC.',
      embeddingId: null,
      metadata: { source: 'conversation', role: 'user' },
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    const result = await service.captureConversationMemories({
      conversationId: 'conversation-1',
      userContent: 'Remember that my preferred deployment window is 2 AM UTC.',
    });

    expect(result).toHaveLength(1);
    expect(repository.createMemory).toHaveBeenCalled();
  });

  it('skips memory selection without tenant context', async () => {
    tenantContextService.isComplete.mockReturnValue(false);

    const result = await service.selectRelevantMemoriesForCompletion({
      conversationId: 'conversation-1',
      userPrompt: 'Hello',
    });

    expect(result).toEqual([]);
    expect(selector.select).not.toHaveBeenCalled();
  });
});
