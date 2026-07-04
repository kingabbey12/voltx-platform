import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiSuccessResponse } from '../src/common/interceptors/response.interceptor';
import { ConversationResponseDto } from '../src/modules/ai/conversations/dto/conversation.dto';
import { MemoryResponseDto, PaginatedMemoriesDto } from '../src/modules/ai/memory/dto/memory.dto';
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

describe('AI Memories (e2e)', () => {
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

  it('supports creating, listing, and soft deleting manual memories', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);

    const conversationResponse = await request(app.getHttpServer())
      .post('/api/v1/ai/conversations')
      .set(bearerAuthHeaders(accessToken))
      .send({ title: 'Memory Sandbox' })
      .expect(201);

    const conversation = (conversationResponse.body as ApiSuccessResponse<ConversationResponseDto>)
      .data;

    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/ai/memories')
      .set(bearerAuthHeaders(accessToken))
      .send({
        conversationId: conversation.id,
        category: 'preference',
        content: 'Remember that my preferred deployment window is 2 AM UTC.',
      })
      .expect(201);

    const created = (createResponse.body as ApiSuccessResponse<MemoryResponseDto>).data;
    expect(created.category).toBe('preference');

    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/ai/memories')
      .set(bearerAuthHeaders(accessToken))
      .expect(200);

    const listed = (listResponse.body as ApiSuccessResponse<PaginatedMemoriesDto>).data;
    expect(listed.total).toBeGreaterThanOrEqual(1);
    expect(listed.items.map((item) => item.id)).toContain(created.id);

    await request(app.getHttpServer())
      .delete(`/api/v1/ai/memories/${created.id}`)
      .set(bearerAuthHeaders(accessToken))
      .expect(200);

    const afterDelete = await request(app.getHttpServer())
      .get('/api/v1/ai/memories')
      .set(bearerAuthHeaders(accessToken))
      .expect(200);

    const afterDeleteBody = (afterDelete.body as ApiSuccessResponse<PaginatedMemoriesDto>).data;
    expect(afterDeleteBody.items.map((item) => item.id)).not.toContain(created.id);
  });

  it('captures important memories automatically from conversation messages', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);

    const conversationResponse = await request(app.getHttpServer())
      .post('/api/v1/ai/conversations')
      .set(bearerAuthHeaders(accessToken))
      .send({ title: 'Memory Capture' })
      .expect(201);

    const conversation = (conversationResponse.body as ApiSuccessResponse<ConversationResponseDto>)
      .data;

    jest.spyOn(aiRuntimeService, 'streamChat').mockImplementation(async function* stream() {
      await Promise.resolve();
      yield {
        type: 'content_delta',
        provider: 'openai',
        model: 'gpt-5-mini',
        delta: 'I will remember that your preferred deployment window is 2 AM UTC.',
      };
      yield {
        type: 'message_end',
        provider: 'openai',
        model: 'gpt-5-mini',
        outputText: 'I will remember that your preferred deployment window is 2 AM UTC.',
        usage: { totalTokens: 28 },
      };
    });

    await request(app.getHttpServer())
      .post(`/api/v1/ai/conversations/${conversation.id}/messages`)
      .set(bearerAuthHeaders(accessToken))
      .send({
        content: 'Remember that my preferred deployment window is 2 AM UTC.',
      })
      .expect(201);

    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/ai/memories')
      .set(bearerAuthHeaders(accessToken))
      .query({ conversationId: conversation.id })
      .expect(200);

    const body = listResponse.body as ApiSuccessResponse<PaginatedMemoriesDto>;
    expect(body.data.total).toBeGreaterThanOrEqual(1);
    expect(body.data.items.some((item) => item.category === 'preference')).toBe(true);
  });
});
