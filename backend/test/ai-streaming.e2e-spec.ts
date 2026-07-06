import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiSuccessResponse } from '../src/common/interceptors/response.interceptor';
import { AgentResponseDto } from '../src/modules/ai/agents/dto/agent.dto';
import { ConversationResponseDto } from '../src/modules/ai/conversations/dto/conversation.dto';
import { ConversationService } from '../src/modules/ai/conversations/conversation.service';
import { TenantContextService } from '../src/common/tenant/tenant-context.service';
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

interface SseFrame {
  event: string;
  id?: number;
  data: Record<string, unknown>;
}

function parseSseFrames(raw: string): SseFrame[] {
  return raw
    .split(/\r?\n\r?\n/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0)
    .map((chunk) => {
      let event = 'message';
      let id: number | undefined;
      const dataLines: string[] = [];

      for (const line of chunk.split(/\r?\n/)) {
        if (line.startsWith('event:')) {
          event = line.slice('event:'.length).trim();
        } else if (line.startsWith('id:')) {
          id = Number(line.slice('id:'.length).trim());
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice('data:'.length).trimStart());
        }
      }

      return {
        event,
        id,
        data: JSON.parse(dataLines.join('\n')) as Record<string, unknown>,
      };
    });
}

describe('AI Streaming (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let usersRepository: UsersRepository;
  let modelRegistryService: ModelRegistryService;
  let aiRuntimeService: AIRuntimeService;
  let conversationService: ConversationService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    usersRepository = app.get(UsersRepository);
    modelRegistryService = app.get(ModelRegistryService);
    aiRuntimeService = app.get(AIRuntimeService);
    conversationService = app.get(ConversationService);
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

  it('streams a conversation message turn with a queued/processing/streaming/completed status lifecycle and sequenced events', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);

    const conversationResponse = await request(app.getHttpServer())
      .post('/api/v1/ai/conversations')
      .set(bearerAuthHeaders(accessToken))
      .send({ title: 'Streaming Conversation' })
      .expect(201);
    const conversation = (conversationResponse.body as ApiSuccessResponse<ConversationResponseDto>)
      .data;

    jest.spyOn(aiRuntimeService, 'streamChat').mockImplementation(async function* stream() {
      await Promise.resolve();
      yield {
        type: 'content_delta',
        provider: 'openai',
        model: 'gpt-5-mini',
        delta: 'Streaming reply.',
      };
      yield {
        type: 'message_end',
        provider: 'openai',
        model: 'gpt-5-mini',
        outputText: 'Streaming reply.',
        usage: { inputTokens: 12, outputTokens: 6, totalTokens: 18 },
      };
    });

    const response = await request(app.getHttpServer())
      .post(`/api/v1/ai/conversations/${conversation.id}/messages/stream`)
      .set(bearerAuthHeaders(accessToken))
      .send({ content: 'Give me a status update.' })
      .expect(200);

    const frames = parseSseFrames(response.text);
    const statuses = frames
      .filter((frame) => frame.event === 'status')
      .map((frame) => frame.data.status);

    expect(statuses).toEqual(['queued', 'processing', 'streaming', 'completed']);
    expect(
      frames.some(
        (frame) => frame.event === 'content_delta' && frame.data.delta === 'Streaming reply.',
      ),
    ).toBe(true);
    expect(frames.some((frame) => frame.event === 'message_end')).toBe(true);
    expect(frames[frames.length - 1]?.event).toBe('done');

    const sequenceIds = frames
      .map((frame) => frame.id)
      .filter((id): id is number => id !== undefined);
    expect(sequenceIds).toEqual([...sequenceIds].sort((a, b) => a - b));
    expect(new Set(sequenceIds).size).toBe(sequenceIds.length);

    const messagesResponse = await request(app.getHttpServer())
      .get(`/api/v1/ai/conversations/${conversation.id}/messages`)
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    const messages = (
      messagesResponse.body as ApiSuccessResponse<{
        items: Array<{ role: string; content: string }>;
      }>
    ).data.items;
    expect(messages.map((message) => message.role)).toEqual(['user', 'assistant']);
    expect(messages[1]?.content).toBe('Streaming reply.');
  });

  it('emits status:failed and an error frame when the provider stream fails mid-turn, without leaving the connection hanging', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);

    const conversationResponse = await request(app.getHttpServer())
      .post('/api/v1/ai/conversations')
      .set(bearerAuthHeaders(accessToken))
      .send({ title: 'Failing Conversation' })
      .expect(201);
    const conversation = (conversationResponse.body as ApiSuccessResponse<ConversationResponseDto>)
      .data;

    jest.spyOn(aiRuntimeService, 'streamChat').mockImplementation(async function* stream() {
      await Promise.resolve();
      yield {
        type: 'content_delta',
        provider: 'openai',
        model: 'gpt-5-mini',
        delta: 'partial',
      };
      throw new Error('provider disconnected');
    });

    const response = await request(app.getHttpServer())
      .post(`/api/v1/ai/conversations/${conversation.id}/messages/stream`)
      .set(bearerAuthHeaders(accessToken))
      .send({ content: 'This will fail.' })
      .expect(200);

    const frames = parseSseFrames(response.text);
    const statuses = frames
      .filter((frame) => frame.event === 'status')
      .map((frame) => frame.data.status);

    expect(statuses).toEqual(['queued', 'processing', 'streaming', 'failed']);
    expect(frames[frames.length - 1]?.event).toBe('error');
    expect(frames[frames.length - 1]?.data.message).toBe('provider disconnected');
  });

  it('streams an agent run with reasoning and tool_call events around the tool loop', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);

    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/ai/agents')
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    const agents = (listResponse.body as ApiSuccessResponse<AgentResponseDto[]>).data;
    const executiveAssistant = agents.find((agent) => agent.name === 'Executive Assistant');

    const conversationResponse = await request(app.getHttpServer())
      .post('/api/v1/ai/conversations')
      .set(bearerAuthHeaders(accessToken))
      .send({ title: 'Streaming Agent Run' })
      .expect(201);
    const conversation = (conversationResponse.body as ApiSuccessResponse<ConversationResponseDto>)
      .data;

    jest.spyOn(aiRuntimeService, 'streamChat').mockImplementation(async function* stream() {
      await Promise.resolve();
      yield {
        type: 'message_end',
        provider: 'openai',
        model: 'gpt-5-mini',
        outputText: 'Done with tools.',
        usage: { inputTokens: 8, outputTokens: 4, totalTokens: 12 },
      };
    });

    const response = await request(app.getHttpServer())
      .post(`/api/v1/ai/agents/${executiveAssistant?.id}/run/stream`)
      .set(bearerAuthHeaders(accessToken))
      .send({
        conversationId: conversation.id,
        prompt: 'What time is it?',
        toolRequests: [{ toolName: 'datetime', input: { timezone: 'UTC' } }],
      })
      .expect(200);

    const frames = parseSseFrames(response.text);

    expect(
      frames.some((frame) => frame.event === 'reasoning' && frame.data.stage === 'planning'),
    ).toBe(true);
    expect(
      frames.some(
        (frame) => frame.event === 'tool_call_start' && frame.data.toolName === 'datetime',
      ),
    ).toBe(true);
    expect(
      frames.some(
        (frame) => frame.event === 'tool_call_result' && frame.data.toolName === 'datetime',
      ),
    ).toBe(true);
    expect(
      frames.some((frame) => frame.event === 'reasoning' && frame.data.stage === 'finalizing'),
    ).toBe(true);

    const statuses = frames
      .filter((frame) => frame.event === 'status')
      .map((frame) => frame.data.status);
    expect(statuses).toEqual(['queued', 'processing', 'streaming', 'completed']);

    const systemClient = prisma.system as unknown as {
      agentRun: {
        findMany(args: { where: { conversationId: string } }): Promise<Array<{ status: string }>>;
      };
    };
    const runs = await systemClient.agentRun.findMany({
      where: { conversationId: conversation.id },
    });
    expect(runs).toHaveLength(1);
    expect(runs[0]?.status).toBe('SUCCEEDED');
  });

  it('emits tool_call_error and fails the run when a requested tool does not exist', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);

    const createAgentResponse = await request(app.getHttpServer())
      .post('/api/v1/ai/agents')
      .set(bearerAuthHeaders(accessToken))
      .send({
        name: 'Broken Tool Agent',
        description: 'Configured with a tool that is not registered.',
        systemPrompt: 'You are a test agent.',
        configuration: { toolNames: ['does_not_exist'] },
      })
      .expect(201);
    const brokenAgent = (createAgentResponse.body as ApiSuccessResponse<AgentResponseDto>).data;

    const conversationResponse = await request(app.getHttpServer())
      .post('/api/v1/ai/conversations')
      .set(bearerAuthHeaders(accessToken))
      .send({ title: 'Tool Failure Run' })
      .expect(201);
    const conversation = (conversationResponse.body as ApiSuccessResponse<ConversationResponseDto>)
      .data;

    const response = await request(app.getHttpServer())
      .post(`/api/v1/ai/agents/${brokenAgent.id}/run/stream`)
      .set(bearerAuthHeaders(accessToken))
      .send({
        conversationId: conversation.id,
        prompt: 'Use a tool that does not exist.',
        toolRequests: [{ toolName: 'does_not_exist', input: {} }],
      })
      .expect(200);

    const frames = parseSseFrames(response.text);
    expect(
      frames.some(
        (frame) => frame.event === 'tool_call_error' && frame.data.toolName === 'does_not_exist',
      ),
    ).toBe(true);
    expect(frames[frames.length - 1]?.event).toBe('error');
  });

  it('cancels an in-flight conversation stream via AbortSignal, marking the turn cancelled instead of hanging', async () => {
    const { user, organization, membership } = await authenticateContext(
      app,
      prisma,
      usersRepository,
    );
    const tenantContextService = app.get(TenantContextService);

    const conversation = await tenantContextService.run(
      {
        organizationId: organization.id,
        userId: user.id,
        membershipId: membership.id,
        requestId: 'test-request-create',
      },
      () => conversationService.createConversation({ title: 'Cancellable Turn' }),
    );

    jest.spyOn(aiRuntimeService, 'streamChat').mockImplementation(async function* stream() {
      yield {
        type: 'content_delta',
        provider: 'openai',
        model: 'gpt-5-mini',
        delta: 'partial before cancel',
      };
      await new Promise((resolve) => setTimeout(resolve, 50));
      throw Object.assign(new Error('The operation was aborted'), { name: 'AbortError' });
    });

    const controller = new AbortController();
    const seenEvents: string[] = [];
    setTimeout(() => controller.abort(), 5);

    await expect(
      tenantContextService.run(
        {
          organizationId: organization.id,
          userId: user.id,
          membershipId: membership.id,
          requestId: 'test-request-stream',
        },
        async () => {
          const generator = conversationService.streamMessageTurn(
            conversation.id,
            { content: 'Cancel me.' },
            controller.signal,
          );

          let result = await generator.next();
          while (!result.done) {
            seenEvents.push(result.value.type);
            result = await generator.next();
          }
        },
      ),
    ).rejects.toThrow('The operation was aborted');

    expect(seenEvents).toContain('status');
  });
});
