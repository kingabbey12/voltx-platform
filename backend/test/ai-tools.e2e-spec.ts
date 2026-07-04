import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiSuccessResponse } from '../src/common/interceptors/response.interceptor';
import {
  ConversationResponseDto,
  PaginatedMessagesDto,
} from '../src/modules/ai/conversations/dto/conversation.dto';
import { ModelRegistryService } from '../src/modules/ai/models/model-registry.service';
import { PrismaService } from '../src/database/prisma.service';
import { UsersRepository } from '../src/modules/users/users.repository';
import { createTestApp } from './create-test-app';
import {
  authenticateContext,
  bearerAuthHeaders,
  resetAndSeedAuthTestData,
} from './helpers/users-test.helper';

describe('AI Tools (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let usersRepository: UsersRepository;
  let modelRegistryService: ModelRegistryService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    usersRepository = app.get(UsersRepository);
    modelRegistryService = app.get(ModelRegistryService);
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

  it('GET /api/v1/ai/tools lists built-in tools', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);

    const response = await request(app.getHttpServer())
      .get('/api/v1/ai/tools')
      .set(bearerAuthHeaders(accessToken))
      .expect(200);

    const body = response.body as ApiSuccessResponse<Array<{ name: string }>>;
    expect(body.data.map((tool) => tool.name)).toEqual(
      expect.arrayContaining(['calculator', 'datetime', 'uuid', 'json', 'http_get', 'http_post']),
    );
  });

  it('POST /api/v1/ai/tools/execute runs a tool, stores execution, and creates a tool message', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);

    const conversationResponse = await request(app.getHttpServer())
      .post('/api/v1/ai/conversations')
      .set(bearerAuthHeaders(accessToken))
      .send({ title: 'Tool Execution Conversation' })
      .expect(201);

    const conversation = (conversationResponse.body as ApiSuccessResponse<ConversationResponseDto>)
      .data;

    const executeResponse = await request(app.getHttpServer())
      .post('/api/v1/ai/tools/execute')
      .set(bearerAuthHeaders(accessToken))
      .send({
        conversationId: conversation.id,
        toolName: 'calculator',
        input: {
          expression: '(4 + 6) * 3',
        },
      })
      .expect(201);

    const executeBody = executeResponse.body as ApiSuccessResponse<{
      execution: { status: string; toolName: string };
      result: { toolName: string; content: string; isError?: boolean };
    }>;

    expect(executeBody.data.execution.status).toBe('SUCCEEDED');
    expect(executeBody.data.execution.toolName).toBe('calculator');
    expect(executeBody.data.result.content).toContain('30');

    const messagesResponse = await request(app.getHttpServer())
      .get(`/api/v1/ai/conversations/${conversation.id}/messages`)
      .set(bearerAuthHeaders(accessToken))
      .expect(200);

    const messagesBody = messagesResponse.body as ApiSuccessResponse<PaginatedMessagesDto>;
    expect(messagesBody.data.items).toHaveLength(1);
    expect(messagesBody.data.items[0]?.role).toBe('tool');

    const systemClient = prisma.system as unknown as {
      toolExecution: {
        findMany(args: {
          where: { conversationId: string };
        }): Promise<Array<{ toolName: string; status: string }>>;
      };
    };
    const executions = await systemClient.toolExecution.findMany({
      where: { conversationId: conversation.id },
    });

    expect(executions).toHaveLength(1);
    expect(executions[0]?.toolName).toBe('calculator');
    expect(executions[0]?.status).toBe('SUCCEEDED');
  });
});
