import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from '../src/modules/audit/audit.service';
import { AgentExecutor } from '../src/modules/ai/agents/agent.executor';
import { AgentFactory } from '../src/modules/ai/agents/agent.factory';
import { AgentRegistry } from '../src/modules/ai/agents/agent.registry';
import { AgentRepository } from '../src/modules/ai/agents/agent.repository';
import { AgentService } from '../src/modules/ai/agents/agent.service';
import { ModelRegistryService } from '../src/modules/ai/models/model-registry.service';

describe('AgentService', () => {
  let service: AgentService;
  let repository: jest.Mocked<AgentRepository>;
  let registry: jest.Mocked<AgentRegistry>;
  let executor: jest.Mocked<AgentExecutor>;
  let factory: jest.Mocked<AgentFactory>;
  let modelRegistry: jest.Mocked<ModelRegistryService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentService,
        {
          provide: AgentRepository,
          useValue: {
            listAgents: jest.fn(),
            findAgentById: jest.fn(),
            findAgentByName: jest.fn(),
            createAgent: jest.fn(),
            updateAgent: jest.fn(),
            softDeleteAgent: jest.fn(),
            createAgentRun: jest.fn(),
            updateAgentRun: jest.fn(),
          },
        },
        {
          provide: AgentRegistry,
          useValue: {
            ensureSystemAgents: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: AgentExecutor,
          useValue: {
            execute: jest.fn(),
          },
        },
        {
          provide: AgentFactory,
          useValue: {
            buildRunOutput: jest.fn().mockReturnValue({ outputText: 'Ready.' }),
          },
        },
        {
          provide: ModelRegistryService,
          useValue: {
            resolveProviderAndModel: jest.fn(),
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

    service = module.get(AgentService);
    repository = module.get(AgentRepository);
    registry = module.get(AgentRegistry);
    executor = module.get(AgentExecutor);
    factory = module.get(AgentFactory);
    modelRegistry = module.get(ModelRegistryService);
  });

  it('lists agents after ensuring built-in system agents exist', async () => {
    repository.listAgents.mockResolvedValue([
      {
        id: 'agent-1',
        organizationId: 'org-1',
        name: 'Executive Assistant',
        description: 'Built-in',
        systemPrompt: 'You are an executive assistant.',
        provider: 'openai',
        model: 'gpt-5-mini',
        configuration: { kind: 'system' },
        enabled: true,
        createdAt: new Date('2026-07-04T00:00:00.000Z'),
        updatedAt: new Date('2026-07-04T00:00:00.000Z'),
        deletedAt: null,
      },
    ]);

    const result = await service.listAgents();

    expect(registry.ensureSystemAgents).toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('Executive Assistant');
  });

  it('creates a custom agent with a resolved provider and model', async () => {
    repository.findAgentByName.mockResolvedValue(null);
    modelRegistry.resolveProviderAndModel.mockResolvedValue({
      provider: { name: 'openai' } as never,
      model: { id: 'gpt-5-mini' } as never,
    });
    repository.createAgent.mockResolvedValue({
      id: 'agent-1',
      organizationId: 'org-1',
      name: 'Procurement Assistant',
      description: 'Helps with procurement',
      systemPrompt: 'You are a procurement assistant.',
      provider: 'openai',
      model: 'gpt-5-mini',
      configuration: { kind: 'custom' },
      enabled: true,
      createdAt: new Date('2026-07-04T00:00:00.000Z'),
      updatedAt: new Date('2026-07-04T00:00:00.000Z'),
      deletedAt: null,
    });

    const result = await service.createAgent({
      name: 'Procurement Assistant',
      description: 'Helps with procurement',
      systemPrompt: 'You are a procurement assistant.',
    });

    expect(modelRegistry.resolveProviderAndModel).toHaveBeenCalled();
    expect(result.provider).toBe('openai');
    expect(result.model).toBe('gpt-5-mini');
  });

  it('rejects duplicate agent names', async () => {
    repository.findAgentByName.mockResolvedValue({
      id: 'agent-1',
      organizationId: 'org-1',
      name: 'Executive Assistant',
      description: 'Built-in',
      systemPrompt: 'System',
      provider: 'openai',
      model: 'gpt-5-mini',
      configuration: { kind: 'system' },
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    await expect(
      service.createAgent({
        name: 'Executive Assistant',
        description: 'Duplicate',
        systemPrompt: 'Duplicate',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates and completes an agent run', async () => {
    registry.ensureSystemAgents.mockResolvedValue(undefined);
    repository.findAgentById.mockResolvedValue({
      id: 'agent-1',
      organizationId: 'org-1',
      name: 'Executive Assistant',
      description: 'Built-in',
      systemPrompt: 'System',
      provider: 'openai',
      model: 'gpt-5-mini',
      configuration: { kind: 'system' },
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
    repository.createAgentRun.mockResolvedValue({
      id: 'run-1',
      agentId: 'agent-1',
      conversationId: 'conversation-1',
      status: 'RUNNING',
      input: {},
      output: {},
      startedAt: new Date('2026-07-04T00:00:00.000Z'),
      completedAt: null,
      durationMs: null,
      tokenUsage: {},
      error: null,
      createdAt: new Date('2026-07-04T00:00:00.000Z'),
    });
    executor.execute.mockResolvedValue({
      outputText: 'Ready.',
      finishReason: 'stop',
      tokenUsage: { totalTokens: 20 },
      userMessage: {
        id: 'msg-user',
        conversationId: 'conversation-1',
        role: 'user',
        content: 'Prepare an update.',
        metadata: {},
        tokenUsage: {},
        createdAt: '2026-07-04T00:00:00.000Z',
      },
      toolMessages: [],
      assistantMessage: {
        id: 'msg-assistant',
        conversationId: 'conversation-1',
        role: 'assistant',
        content: 'Ready.',
        metadata: {},
        tokenUsage: { totalTokens: 20 },
        createdAt: '2026-07-04T00:00:01.000Z',
      },
      toolResults: [],
    });
    repository.updateAgentRun.mockResolvedValue({
      id: 'run-1',
      agentId: 'agent-1',
      conversationId: 'conversation-1',
      status: 'SUCCEEDED',
      input: {},
      output: { outputText: 'Ready.' },
      startedAt: new Date('2026-07-04T00:00:00.000Z'),
      completedAt: new Date('2026-07-04T00:00:01.000Z'),
      durationMs: 1000,
      tokenUsage: { totalTokens: 20 },
      error: null,
      createdAt: new Date('2026-07-04T00:00:00.000Z'),
    });

    const result = await service.runAgent('agent-1', {
      conversationId: 'conversation-1',
      prompt: 'Prepare an update.',
    });

    expect(executor.execute).toHaveBeenCalled();
    expect(factory.buildRunOutput).toHaveBeenCalled();
    expect(result.run.status).toBe('SUCCEEDED');
    expect(result.assistantMessage?.content).toBe('Ready.');
  });

  it('rejects running a disabled agent', async () => {
    registry.ensureSystemAgents.mockResolvedValue(undefined);
    repository.findAgentById.mockResolvedValue({
      id: 'agent-1',
      organizationId: 'org-1',
      name: 'Disabled Agent',
      description: 'Disabled',
      systemPrompt: 'System',
      provider: 'openai',
      model: 'gpt-5-mini',
      configuration: { kind: 'custom' },
      enabled: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });

    await expect(
      service.runAgent('agent-1', {
        conversationId: 'conversation-1',
        prompt: 'Hello',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws when updating an unknown agent', async () => {
    repository.findAgentById.mockResolvedValue(null);

    await expect(service.updateAgent('missing', { name: 'New Name' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
