import { Test, TestingModule } from '@nestjs/testing';
import { PromptBuilderService } from '../src/modules/ai/prompts/prompt-builder.service';

describe('PromptBuilderService', () => {
  let service: PromptBuilderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PromptBuilderService],
    }).compile();

    service = module.get(PromptBuilderService);
  });

  it('builds a normalized prompt with system, memories, history, tools, and user prompt', async () => {
    const messages = await service.build({
      systemPrompt: 'Custom system prompt',
      workspaceContext: ['Workspace: Voltx', 'Region: us-east-1'],
      relevantMemories: [
        {
          id: 'memory-1',
          organizationId: 'org-1',
          userId: 'user-1',
          conversationId: 'conversation-1',
          category: 'preference',
          importance: 0.9,
          content: 'User prefers deployment windows at 02:00 UTC.',
          embeddingId: null,
          metadata: {},
          createdAt: new Date('2026-07-04T00:00:00.000Z'),
          updatedAt: new Date('2026-07-04T00:00:00.000Z'),
          deletedAt: null,
        },
      ],
      conversationHistory: [
        { role: 'user', content: '  Earlier question  ' },
        { role: 'assistant', content: 'Previous answer' },
      ],
      toolResults: [
        {
          toolName: 'search_files',
          content: 'Found 3 matching files.',
        },
      ],
      userPrompt: 'What should I do next?',
    });

    expect(messages[0].role).toBe('system');
    expect(messages[0].content).toContain('Custom system prompt');
    expect(messages[0].content).toContain('Workspace Context:');
    expect(messages[0].content).toContain('Relevant Memories:');
    expect(messages[1]).toEqual({
      role: 'user',
      content: 'Earlier question',
    });
    expect(messages[2]).toEqual({
      role: 'assistant',
      content: 'Previous answer',
    });
    expect(messages[3].role).toBe('tool');
    expect(messages[3].name).toBe('search_files');
    expect(messages[4]).toEqual({
      role: 'user',
      content: 'What should I do next?',
    });
  });
});
