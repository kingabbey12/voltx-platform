import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiSuccessResponse } from '../src/common/interceptors/response.interceptor';
import { AgentResponseDto, RunAgentResponseDto } from '../src/modules/ai/agents/dto/agent.dto';
import { ConversationResponseDto } from '../src/modules/ai/conversations/dto/conversation.dto';
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
  data: Record<string, unknown>;
}

function parseSseFrames(raw: string): SseFrame[] {
  return raw
    .split(/\r?\n\r?\n/)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0)
    .map((chunk) => {
      let event = 'message';
      const dataLines: string[] = [];

      for (const line of chunk.split(/\r?\n/)) {
        if (line.startsWith('event:')) {
          event = line.slice('event:'.length).trim();
        } else if (line.startsWith('data:')) {
          dataLines.push(line.slice('data:'.length).trimStart());
        }
      }

      return { event, data: JSON.parse(dataLines.join('\n')) as Record<string, unknown> };
    });
}

function chatEventsFor(text: string) {
  return (async function* stream() {
    await Promise.resolve();
    yield {
      type: 'message_end' as const,
      provider: 'openai' as const,
      model: 'gpt-5-mini',
      outputText: text,
    };
  })();
}

describe('AI Autonomous Agents (e2e)', () => {
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

  async function createAgentWithTools(
    accessToken: string,
    toolNames: string[],
  ): Promise<AgentResponseDto> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/ai/agents')
      .set(bearerAuthHeaders(accessToken))
      .send({
        name: `Autonomous Test Agent ${Date.now()}-${Math.random()}`,
        description: 'An autonomous test agent.',
        systemPrompt: 'You are a helpful autonomous test agent.',
        configuration: { toolNames },
      })
      .expect(201);
    return (response.body as ApiSuccessResponse<AgentResponseDto>).data;
  }

  async function createConversation(accessToken: string): Promise<ConversationResponseDto> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/ai/conversations')
      .set(bearerAuthHeaders(accessToken))
      .send({ title: 'Autonomous Run' })
      .expect(201);
    return (response.body as ApiSuccessResponse<ConversationResponseDto>).data;
  }

  it('streams a full plan -> reason -> tool -> observe -> finalize lifecycle and persists agent state', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);
    const agent = await createAgentWithTools(accessToken, ['datetime']);
    const conversation = await createConversation(accessToken);

    jest
      .spyOn(aiRuntimeService, 'streamChat')
      .mockImplementationOnce(() =>
        chatEventsFor(JSON.stringify({ steps: ['Check the time', 'Report it'] })),
      )
      .mockImplementationOnce(() =>
        chatEventsFor(
          JSON.stringify({
            action: 'tool_call',
            thought: 'need time',
            toolName: 'datetime',
            input: {},
          }),
        ),
      )
      .mockImplementationOnce(() =>
        chatEventsFor(
          JSON.stringify({
            action: 'final_answer',
            content: 'The current time has been reported.',
          }),
        ),
      );

    const response = await request(app.getHttpServer())
      .post(`/api/v1/ai/agents/${agent.id}/run/autonomous/stream`)
      .set(bearerAuthHeaders(accessToken))
      .send({ conversationId: conversation.id, objective: 'Find and report the current time.' })
      .expect(200);

    const frames = parseSseFrames(response.text);
    const eventTypes = frames.map((frame) => frame.event);

    expect(eventTypes).toContain('plan');
    expect(eventTypes).toContain('step_started');
    expect(eventTypes).toContain('decision');
    expect(eventTypes).toContain('tool_call_start');
    expect(eventTypes).toContain('tool_call_result');
    expect(eventTypes).toContain('next_step');
    expect(eventTypes).toContain('message_end');
    expect(frames[frames.length - 1]?.event).toBe('done');

    const statuses = frames
      .filter((frame) => frame.event === 'status')
      .map((frame) => frame.data.status);
    expect(statuses).toEqual(['queued', 'processing', 'streaming', 'completed']);

    const systemClient = prisma.system as unknown as {
      agentRun: {
        findMany(args: { where: { conversationId: string } }): Promise<
          Array<{
            id: string;
            status: string;
            iterationCount: number;
            toolCallCount: number;
            currentStep: number;
          }>
        >;
      };
      agentRunStep: {
        findMany(args: { where: { agentRunId: string } }): Promise<Array<{ type: string }>>;
      };
    };

    const runs = await systemClient.agentRun.findMany({
      where: { conversationId: conversation.id },
    });
    expect(runs).toHaveLength(1);
    expect(runs[0]?.status).toBe('SUCCEEDED');
    expect(runs[0]?.iterationCount).toBe(2);
    expect(runs[0]?.toolCallCount).toBe(1);

    const steps = await systemClient.agentRunStep.findMany({ where: { agentRunId: runs[0].id } });
    const stepTypes = steps.map((step) => step.type);
    expect(stepTypes).toContain('PLAN');
    expect(stepTypes).toContain('TOOL_CALL');
    expect(stepTypes).toContain('TOOL_RESULT');
    expect(stepTypes).toContain('FINAL_ANSWER');

    const messagesResponse = await request(app.getHttpServer())
      .get(`/api/v1/ai/conversations/${conversation.id}/messages`)
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    const messages = (
      messagesResponse.body as ApiSuccessResponse<{ items: Array<{ role: string }> }>
    ).data.items;
    expect(messages.map((message) => message.role)).toEqual(['user', 'tool', 'assistant']);
  });

  it('supports the non-streaming JSON autonomous endpoint', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);
    const agent = await createAgentWithTools(accessToken, []);
    const conversation = await createConversation(accessToken);

    jest
      .spyOn(aiRuntimeService, 'streamChat')
      .mockImplementationOnce(() => chatEventsFor(JSON.stringify({ steps: ['Answer directly'] })))
      .mockImplementationOnce(() =>
        chatEventsFor(JSON.stringify({ action: 'final_answer', content: 'Immediate answer.' })),
      );

    const response = await request(app.getHttpServer())
      .post(`/api/v1/ai/agents/${agent.id}/run/autonomous`)
      .set(bearerAuthHeaders(accessToken))
      .send({ conversationId: conversation.id, objective: 'Answer immediately.' })
      .expect(201);

    const body = (response.body as ApiSuccessResponse<RunAgentResponseDto>).data;
    expect(body.run.status).toBe('SUCCEEDED');
    expect(body.assistantMessage?.content).toBe('Immediate answer.');
  });

  it('recovers via a forced final answer when the iteration limit is reached', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);
    const agent = await createAgentWithTools(accessToken, ['datetime']);
    const conversation = await createConversation(accessToken);

    jest
      .spyOn(aiRuntimeService, 'streamChat')
      .mockImplementationOnce(() => chatEventsFor(JSON.stringify({ steps: ['Keep checking'] })))
      .mockImplementationOnce(() =>
        chatEventsFor(JSON.stringify({ action: 'tool_call', toolName: 'datetime', input: {} })),
      )
      .mockImplementationOnce(() =>
        chatEventsFor(JSON.stringify({ action: 'tool_call', toolName: 'datetime', input: {} })),
      )
      .mockImplementationOnce(() => chatEventsFor('Here is my best effort summary.'));

    const response = await request(app.getHttpServer())
      .post(`/api/v1/ai/agents/${agent.id}/run/autonomous`)
      .set(bearerAuthHeaders(accessToken))
      .send({
        conversationId: conversation.id,
        objective: 'Never stop checking.',
        maxIterations: 2,
      })
      .expect(201);

    const body = (response.body as ApiSuccessResponse<RunAgentResponseDto>).data;
    expect(body.run.status).toBe('SUCCEEDED');
    expect(body.run.iterationCount).toBe(2);
    expect(body.assistantMessage?.content).toBe('Here is my best effort summary.');
    expect(body.run.output.stoppedReason).toBe('max_iterations');
  });
});
