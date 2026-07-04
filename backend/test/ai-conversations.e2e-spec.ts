import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiSuccessResponse } from '../src/common/interceptors/response.interceptor';
import {
  ConversationResponseDto,
  MessageResponseDto,
  PaginatedConversationsDto,
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

describe('AI Conversations (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let usersRepository: UsersRepository;
  let modelRegistryService: ModelRegistryService;
  let aiRuntimeService: AIRuntimeService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    usersRepository = app.get(UsersRepository);
    modelRegistryService = app.get(ModelRegistryService);
    aiRuntimeService = app.get(AIRuntimeService);
  });

  beforeEach(async () => {
    jest.restoreAllMocks();
    await resetAndSeedAuthTestData(prisma);

    jest.spyOn(modelRegistryService, 'resolveProviderAndModel').mockResolvedValue({
      provider: { name: 'openai' } as never,
      model: {
        id: 'gpt-5-mini',
        provider: 'openai',
        family: 'gpt-5',
        displayName: 'GPT-5 Mini',
        supportsStreaming: true,
        supportsEmbeddings: false,
      } as never,
    });
  });

  afterAll(async () => {
    await resetAndSeedAuthTestData(prisma);
    await app.close();
  });

  it('POST /api/v1/ai/conversations creates a conversation with resolved provider and model', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);

    const response = await request(app.getHttpServer())
      .post('/api/v1/ai/conversations')
      .set(bearerAuthHeaders(accessToken))
      .send({})
      .expect(201);

    const body = response.body as ApiSuccessResponse<ConversationResponseDto>;
    expect(body.data.title).toBe('New conversation');
    expect(body.data.provider).toBe('openai');
    expect(body.data.model).toBe('gpt-5-mini');
  });

  it('GET and PATCH conversation endpoints support pagination, search, pinning, and archiving', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);

    const firstResponse = await request(app.getHttpServer())
      .post('/api/v1/ai/conversations')
      .set(bearerAuthHeaders(accessToken))
      .send({ title: 'Quarterly Planning' })
      .expect(201);

    const firstConversation = (firstResponse.body as ApiSuccessResponse<ConversationResponseDto>)
      .data;

    await request(app.getHttpServer())
      .post('/api/v1/ai/conversations')
      .set(bearerAuthHeaders(accessToken))
      .send({ title: 'Incident Review' })
      .expect(201);

    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/ai/conversations')
      .set(bearerAuthHeaders(accessToken))
      .query({ search: 'planning' })
      .expect(200);

    const listBody = listResponse.body as ApiSuccessResponse<PaginatedConversationsDto>;
    expect(listBody.data.total).toBe(1);
    expect(listBody.data.items[0]?.title).toBe('Quarterly Planning');

    const updateResponse = await request(app.getHttpServer())
      .patch(`/api/v1/ai/conversations/${firstConversation.id}`)
      .set(bearerAuthHeaders(accessToken))
      .send({ pinned: true, archived: true })
      .expect(200);

    const updateBody = updateResponse.body as ApiSuccessResponse<ConversationResponseDto>;
    expect(updateBody.data.pinned).toBe(true);
    expect(updateBody.data.archived).toBe(true);
  });

  it('POST /api/v1/ai/conversations/:id/messages stores user and assistant messages', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);

    const conversationResponse = await request(app.getHttpServer())
      .post('/api/v1/ai/conversations')
      .set(bearerAuthHeaders(accessToken))
      .send({})
      .expect(201);

    const conversation = (conversationResponse.body as ApiSuccessResponse<ConversationResponseDto>)
      .data;

    jest.spyOn(aiRuntimeService, 'streamChat').mockImplementation(async function* stream() {
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
          inputTokens: 25,
          outputTokens: 12,
          totalTokens: 37,
        },
      };
    });

    const messageResponse = await request(app.getHttpServer())
      .post(`/api/v1/ai/conversations/${conversation.id}/messages`)
      .set(bearerAuthHeaders(accessToken))
      .send({ content: 'Summarize the risk posture.' })
      .expect(201);

    const messageBody = messageResponse.body as ApiSuccessResponse<{
      userMessage: MessageResponseDto;
      toolMessages: MessageResponseDto[];
      assistantMessage: MessageResponseDto | null;
    }>;

    expect(messageBody.data.userMessage.role).toBe('user');
    expect(messageBody.data.assistantMessage?.role).toBe('assistant');
    expect(messageBody.data.assistantMessage?.tokenUsage.totalTokens).toBe(37);

    const messagesResponse = await request(app.getHttpServer())
      .get(`/api/v1/ai/conversations/${conversation.id}/messages`)
      .set(bearerAuthHeaders(accessToken))
      .expect(200);

    const messagesBody = messagesResponse.body as ApiSuccessResponse<PaginatedMessagesDto>;
    expect(messagesBody.data.items).toHaveLength(2);
    expect(messagesBody.data.items[1]?.content).toBe('Executive summary ready.');
  });

  it('DELETE /api/v1/ai/conversations/:id soft deletes the conversation', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);

    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/ai/conversations')
      .set(bearerAuthHeaders(accessToken))
      .send({ title: 'Delete Me' })
      .expect(201);

    const conversation = (createResponse.body as ApiSuccessResponse<ConversationResponseDto>).data;

    await request(app.getHttpServer())
      .delete(`/api/v1/ai/conversations/${conversation.id}`)
      .set(bearerAuthHeaders(accessToken))
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/ai/conversations/${conversation.id}`)
      .set(bearerAuthHeaders(accessToken))
      .expect(404);
  });
});
