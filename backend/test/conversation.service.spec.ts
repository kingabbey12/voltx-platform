import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AttachmentService } from '../src/modules/attachments/attachment.service';
import { AuditService } from '../src/modules/audit/audit.service';
import { ConversationRepository } from '../src/modules/ai/conversations/conversation.repository';
import { ConversationService } from '../src/modules/ai/conversations/conversation.service';
import { AIGatewayService } from '../src/modules/ai/gateway/ai-gateway.service';
import { MemoryService } from '../src/modules/ai/memory/memory.service';
import { ModelRegistryService } from '../src/modules/ai/models/model-registry.service';

describe('ConversationService', () => {
  let service: ConversationService;
  let repository: jest.Mocked<ConversationRepository>;
  let aiGatewayService: jest.Mocked<AIGatewayService>;
  let modelRegistryService: jest.Mocked<ModelRegistryService>;
  let memoryService: jest.Mocked<MemoryService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConversationService,
        {
          provide: ConversationRepository,
          useValue: {
            createConversation: jest.fn(),
            findConversationById: jest.fn(),
            findAllConversations: jest.fn(),
            updateConversation: jest.fn(),
            softDeleteConversation: jest.fn(),
            createMessage: jest.fn(),
            findMessages: jest.fn(),
            findAllMessagesForConversation: jest.fn(),
          },
        },
        {
          provide: ModelRegistryService,
          useValue: {
            resolveProviderAndModel: jest.fn(),
          },
        },
        {
          provide: AIGatewayService,
          useValue: {
            streamChat: jest.fn(),
          },
        },
        {
          provide: MemoryService,
          useValue: {
            captureConversationMemories: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: AuditService,
          useValue: {
            record: jest.fn(),
          },
        },
        {
          provide: AttachmentService,
          useValue: {
            addReference: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(ConversationService);
    repository = module.get(ConversationRepository);
    aiGatewayService = module.get(AIGatewayService);
    modelRegistryService = module.get(ModelRegistryService);
    memoryService = module.get(MemoryService);
  });

  it('creates a conversation using the resolved default model and provider', async () => {
    modelRegistryService.resolveProviderAndModel.mockResolvedValue({
      provider: {
        name: 'openai',
      } as never,
      model: {
        id: 'gpt-5-mini',
      } as never,
    });

    repository.createConversation.mockResolvedValue({
      id: 'conversation-1',
      organizationId: 'org-1',
      userId: 'user-1',
      title: 'New conversation',
      model: 'gpt-5-mini',
      provider: 'openai',
      pinned: false,
      archived: false,
      createdAt: new Date('2026-07-04T00:00:00.000Z'),
      updatedAt: new Date('2026-07-04T00:00:00.000Z'),
      deletedAt: null,
    });

    const result = await service.createConversation({});

    expect(result.title).toBe('New conversation');
    expect(repository.createConversation).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'gpt-5-mini',
        provider: 'openai',
      }),
    );
  });

  it('creates user and assistant messages and auto-generates a title from the first prompt', async () => {
    modelRegistryService.resolveProviderAndModel.mockResolvedValue({
      provider: {
        name: 'openai',
      } as never,
      model: {
        id: 'gpt-5-mini',
      } as never,
    });

    repository.findConversationById.mockResolvedValue({
      id: 'conversation-1',
      organizationId: 'org-1',
      userId: 'user-1',
      title: 'New conversation',
      model: 'gpt-5-mini',
      provider: 'openai',
      pinned: false,
      archived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
    repository.findAllMessagesForConversation.mockResolvedValue([]);
    repository.createMessage
      .mockResolvedValueOnce({
        id: 'message-user',
        conversationId: 'conversation-1',
        role: 'user',
        content: 'Summarize the incident mitigation plan',
        metadata: {},
        tokenUsage: {},
        createdAt: new Date('2026-07-04T00:00:00.000Z'),
      })
      .mockResolvedValueOnce({
        id: 'message-assistant',
        conversationId: 'conversation-1',
        role: 'assistant',
        content: 'Here is the mitigation summary.',
        metadata: { provider: 'openai', model: 'gpt-5-mini' },
        tokenUsage: { totalTokens: 25 },
        createdAt: new Date('2026-07-04T00:00:01.000Z'),
      });

    aiGatewayService.streamChat.mockImplementation(async function* stream() {
      await Promise.resolve();
      yield {
        type: 'content_delta',
        provider: 'openai',
        model: 'gpt-5-mini',
        delta: 'Here is the mitigation summary.',
      };
      yield {
        type: 'message_end',
        provider: 'openai',
        model: 'gpt-5-mini',
        outputText: 'Here is the mitigation summary.',
        usage: { totalTokens: 25 },
      };
    });

    const result = await service.createMessage('conversation-1', {
      content: 'Summarize the incident mitigation plan',
    });

    expect(repository.updateConversation).toHaveBeenCalledWith('conversation-1', {
      title: 'Summarize the incident mitigation plan',
    });
    expect(memoryService.captureConversationMemories).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: 'conversation-1',
        userContent: 'Summarize the incident mitigation plan',
      }),
    );
    expect(result.assistantMessage?.tokenUsage.totalTokens).toBe(25);
  });

  it('throws when the conversation does not exist', async () => {
    repository.findConversationById.mockResolvedValue(null);

    await expect(
      service.getConversation('00000000-0000-0000-0000-000000000000'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
