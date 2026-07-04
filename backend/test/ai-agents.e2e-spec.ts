import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiSuccessResponse } from '../src/common/interceptors/response.interceptor';
import { AgentResponseDto, RunAgentResponseDto } from '../src/modules/ai/agents/dto/agent.dto';
import { AIModule } from '../src/modules/ai/ai.module';
import {
  ConversationResponseDto,
  PaginatedMessagesDto,
} from '../src/modules/ai/conversations/dto/conversation.dto';
import { ModelRegistryService } from '../src/modules/ai/models/model-registry.service';
import { AIRuntimeService } from '../src/modules/ai/runtime/ai-runtime.service';
import { PrismaService } from '../src/database/prisma.service';
import { UsersRepository } from '../src/modules/users/users.repository';
import { createTestApp } from './create-test-app';
import {
  authenticateContext,
  bearerAuthHeaders,
  resetAndSeedAuthTestData,
} from './helpers/users-test.helper';

describe('AI Agents (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let usersRepository: UsersRepository;
  let aiModelRegistryService: ModelRegistryService;
  let agentRuntimeService: AIRuntimeService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    usersRepository = app.get(UsersRepository);
    aiModelRegistryService = app.select(AIModule).get(ModelRegistryService, { strict: true });
    agentRuntimeService = app.select(AIModule).get(AIRuntimeService, { strict: true });
  });

  beforeEach(async () => {
    jest.restoreAllMocks();
    await resetAndSeedAuthTestData(prisma);

    const resolvedModel = {
      provider: { name: 'openai' } as never,
      model: {
        id: 'gpt-5-mini',
        provider: 'openai',
        family: 'gpt-5',
        displayName: 'GPT-5 Mini',
        supportsStreaming: true,
        supportsEmbeddings: false,
      } as never,
    };
    jest.spyOn(aiModelRegistryService, 'resolveProviderAndModel').mockResolvedValue(resolvedModel);
  });

  afterAll(async () => {
    await resetAndSeedAuthTestData(prisma);
    await app.close();
  });

  it('GET /api/v1/ai/agents lists built-in system agents', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);

    const response = await request(app.getHttpServer())
      .get('/api/v1/ai/agents')
      .set(bearerAuthHeaders(accessToken))
      .expect(200);

    const body = response.body as ApiSuccessResponse<AgentResponseDto[]>;
    expect(body.data.map((agent) => agent.name)).toEqual(
      expect.arrayContaining([
        'Executive Assistant',
        'Research Analyst',
        'Sales Assistant',
        'Customer Support',
        'Operations Assistant',
      ]),
    );
  });

  it('POST, PATCH, and DELETE /api/v1/ai/agents manage custom agents', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);

    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/ai/agents')
      .set(bearerAuthHeaders(accessToken))
      .send({
        name: 'Procurement Assistant',
        description: 'Handles vendor prep and procurement support.',
        systemPrompt: 'You are a procurement assistant.',
        configuration: {
          toolNames: ['calculator', 'json'],
        },
      })
      .expect(201);

    const created = (createResponse.body as ApiSuccessResponse<AgentResponseDto>).data;
    expect(created.name).toBe('Procurement Assistant');
    expect(created.provider).toBe('openai');

    const updateResponse = await request(app.getHttpServer())
      .patch(`/api/v1/ai/agents/${created.id}`)
      .set(bearerAuthHeaders(accessToken))
      .send({
        description: 'Updated procurement support assistant.',
        enabled: false,
      })
      .expect(200);

    const updated = (updateResponse.body as ApiSuccessResponse<AgentResponseDto>).data;
    expect(updated.description).toBe('Updated procurement support assistant.');
    expect(updated.enabled).toBe(false);

    await request(app.getHttpServer())
      .delete(`/api/v1/ai/agents/${created.id}`)
      .set(bearerAuthHeaders(accessToken))
      .expect(200);

    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/ai/agents')
      .set(bearerAuthHeaders(accessToken))
      .expect(200);

    const listed = (listResponse.body as ApiSuccessResponse<AgentResponseDto[]>).data;
    expect(listed.some((item) => item.id === created.id)).toBe(false);
  });

  it('POST /api/v1/ai/agents/:id/run creates an execution history record and conversation messages', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);

    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/ai/agents')
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    const agents = (listResponse.body as ApiSuccessResponse<AgentResponseDto[]>).data;
    const executiveAssistant = agents.find((agent) => agent.name === 'Executive Assistant');
    expect(executiveAssistant).toBeDefined();

    const conversationResponse = await request(app.getHttpServer())
      .post('/api/v1/ai/conversations')
      .set(bearerAuthHeaders(accessToken))
      .send({ title: 'Agent Runtime Conversation' })
      .expect(201);
    const conversation = (conversationResponse.body as ApiSuccessResponse<ConversationResponseDto>)
      .data;

    jest.spyOn(agentRuntimeService, 'streamChat').mockImplementation(async function* stream() {
      await Promise.resolve();
      yield {
        type: 'content_delta',
        provider: 'openai',
        model: 'gpt-5-mini',
        delta: 'Executive summary ready.',
      };
      yield {
        type: 'message_end',
        provider: 'openai',
        model: 'gpt-5-mini',
        outputText: 'Executive summary ready.',
        usage: {
          inputTokens: 30,
          outputTokens: 14,
          totalTokens: 44,
        },
      };
    });

    const runResponse = await request(app.getHttpServer())
      .post(`/api/v1/ai/agents/${executiveAssistant?.id}/run`)
      .set(bearerAuthHeaders(accessToken))
      .send({
        conversationId: conversation.id,
        prompt: 'Prepare an executive update on platform risk.',
      })
      .expect(201);

    const runBody = runResponse.body as ApiSuccessResponse<RunAgentResponseDto>;
    expect(runBody.data.run.status).toBe('SUCCEEDED');
    expect(runBody.data.assistantMessage?.content).toBe('Executive summary ready.');
    expect(runBody.data.run.tokenUsage.totalTokens).toBe(44);

    const messagesResponse = await request(app.getHttpServer())
      .get(`/api/v1/ai/conversations/${conversation.id}/messages`)
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    const messagesBody = messagesResponse.body as ApiSuccessResponse<PaginatedMessagesDto>;
    expect(messagesBody.data.items).toHaveLength(2);
    expect(messagesBody.data.items[0]?.role).toBe('user');
    expect(messagesBody.data.items[1]?.role).toBe('assistant');

    const systemClient = prisma.system as unknown as {
      agentRun: {
        findMany(args: {
          where: { conversationId: string };
        }): Promise<Array<{ agentId: string; status: string }>>;
      };
    };
    const runs = await systemClient.agentRun.findMany({
      where: { conversationId: conversation.id },
    });
    expect(runs).toHaveLength(1);
    expect(runs[0]?.status).toBe('SUCCEEDED');
  });

  it('RBAC blocks viewers from creating agents', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository, 'viewer', {
      email: 'viewer.ai@example.com',
    });

    await request(app.getHttpServer())
      .post('/api/v1/ai/agents')
      .set(bearerAuthHeaders(accessToken))
      .send({
        name: 'Blocked Agent',
        description: 'Should not be created',
        systemPrompt: 'Blocked',
      })
      .expect(403);
  });
});
