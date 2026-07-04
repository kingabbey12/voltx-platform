import { Test, TestingModule } from '@nestjs/testing';
import { ConversationMemoryService } from '../src/modules/ai/memory/conversation-memory.service';
import { PromptBuilderService } from '../src/modules/ai/prompts/prompt-builder.service';

describe('PromptBuilderService', () => {
  let service: PromptBuilderService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PromptBuilderService, ConversationMemoryService],
    }).compile();

    service = module.get(PromptBuilderService);
  });

  it('builds a normalized prompt with system, history, tools, and user prompt', () => {
    const messages = service.build({
      systemPrompt: 'Custom system prompt',
      workspaceContext: ['Workspace: Voltx', 'Region: us-east-1'],
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
