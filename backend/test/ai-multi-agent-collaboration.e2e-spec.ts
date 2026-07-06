import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiSuccessResponse } from '../src/common/interceptors/response.interceptor';
import { AgentResponseDto, AgentRunResponseDto } from '../src/modules/ai/agents/dto/agent.dto';
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

interface AgentRunSystemRecord {
  id: string;
  parentRunId: string | null;
  rootRunId: string | null;
  depth: number;
  status: string;
}

interface AgentRunStepSystemRecord {
  type: string;
}

interface AgentMessageSystemRecord {
  type: string;
  fromAgentRunId: string;
  toAgentRunId: string | null;
}

describe('AI Multi-Agent Collaboration (e2e)', () => {
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

  async function createAgent(
    accessToken: string,
    params: { name: string; systemPrompt: string },
  ): Promise<AgentResponseDto> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/ai/agents')
      .set(bearerAuthHeaders(accessToken))
      .send({
        name: `${params.name} ${Date.now()}-${Math.random()}`,
        description: `${params.name} test agent.`,
        systemPrompt: params.systemPrompt,
        configuration: { toolNames: [] },
      })
      .expect(201);
    return (response.body as ApiSuccessResponse<AgentResponseDto>).data;
  }

  async function createConversation(accessToken: string): Promise<ConversationResponseDto> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/ai/conversations')
      .set(bearerAuthHeaders(accessToken))
      .send({ title: 'Multi-Agent Run' })
      .expect(201);
    return (response.body as ApiSuccessResponse<ConversationResponseDto>).data;
  }

  async function fetchAgentRuns(conversationId: string): Promise<AgentRunSystemRecord[]> {
    const systemClient = prisma.system as unknown as {
      agentRun: {
        findMany(args: { where: { conversationId: string } }): Promise<AgentRunSystemRecord[]>;
      };
    };
    return systemClient.agentRun.findMany({ where: { conversationId } });
  }

  async function fetchAgentRunSteps(agentRunId: string): Promise<AgentRunStepSystemRecord[]> {
    const systemClient = prisma.system as unknown as {
      agentRunStep: {
        findMany(args: { where: { agentRunId: string } }): Promise<AgentRunStepSystemRecord[]>;
      };
    };
    return systemClient.agentRunStep.findMany({ where: { agentRunId } });
  }

  async function fetchAgentMessages(rootRunId: string): Promise<AgentMessageSystemRecord[]> {
    const systemClient = prisma.system as unknown as {
      agentMessage: {
        findMany(args: { where: { rootRunId: string } }): Promise<AgentMessageSystemRecord[]>;
      };
    };
    return systemClient.agentMessage.findMany({ where: { rootRunId } });
  }

  it('delegates sequentially to another agent, persists the execution tree, and streams coordinator + wrapped child events', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);
    const coordinator = await createAgent(accessToken, {
      name: 'Coordinator',
      systemPrompt: 'PERSONA_COORDINATOR: You orchestrate other specialist agents.',
    });
    const worker = await createAgent(accessToken, {
      name: 'Sales Specialist',
      systemPrompt: 'PERSONA_WORKER: You summarize sales pipeline data.',
    });
    const conversation = await createConversation(accessToken);

    let coordinatorReasoningCalls = 0;
    jest.spyOn(aiRuntimeService, 'streamChat').mockImplementation((input) => {
      const systemPrompt = input.systemPrompt ?? '';
      if (systemPrompt.includes('planning module')) {
        return chatEventsFor(JSON.stringify({ steps: ['Work the objective'] }));
      }
      if (systemPrompt.includes('PERSONA_COORDINATOR')) {
        coordinatorReasoningCalls += 1;
        if (coordinatorReasoningCalls === 1) {
          return chatEventsFor(
            JSON.stringify({
              action: 'delegate',
              thought: 'Need the sales specialist.',
              agentName: worker.name,
              objective: 'Summarize the current sales pipeline.',
            }),
          );
        }
        return chatEventsFor(
          JSON.stringify({ action: 'final_answer', content: 'Executive summary complete.' }),
        );
      }
      return chatEventsFor(
        JSON.stringify({ action: 'final_answer', content: 'Pipeline is healthy.' }),
      );
    });

    const response = await request(app.getHttpServer())
      .post(`/api/v1/ai/agents/${coordinator.id}/run/autonomous/stream`)
      .set(bearerAuthHeaders(accessToken))
      .send({
        conversationId: conversation.id,
        objective: 'Prepare an executive summary using specialist input.',
      })
      .expect(200);

    const frames = parseSseFrames(response.text);
    const eventTypes = frames.map((frame) => frame.event);

    expect(eventTypes).toContain('coordinator_started');
    expect(eventTypes).toContain('agent_spawned');
    expect(eventTypes).toContain('delegation');
    expect(eventTypes).toContain('agent_waiting');
    expect(eventTypes).toContain('aggregation');
    expect(eventTypes).toContain('coordinator_finished');
    expect(eventTypes).toContain('agent_event');
    expect(frames[frames.length - 1]?.event).toBe('done');

    const wrappedChildEventTypes = frames
      .filter((frame) => frame.event === 'agent_event')
      .map((frame) => (frame.data.event as Record<string, unknown> | undefined)?.type);
    expect(wrappedChildEventTypes).toContain('plan');
    expect(wrappedChildEventTypes).toContain('decision');

    const runs = await fetchAgentRuns(conversation.id);
    expect(runs).toHaveLength(2);
    const rootRun = runs.find((run) => run.parentRunId === null);
    const childRun = runs.find((run) => run.parentRunId !== null);
    expect(rootRun).toBeDefined();
    expect(childRun).toBeDefined();
    expect(rootRun?.status).toBe('SUCCEEDED');
    expect(childRun?.status).toBe('SUCCEEDED');
    expect(childRun?.depth).toBe(1);
    expect(childRun?.rootRunId).toBe(rootRun?.id);

    const parentSteps = await fetchAgentRunSteps(rootRun!.id);
    const parentStepTypes = parentSteps.map((step) => step.type);
    expect(parentStepTypes).toContain('DELEGATION_START');
    expect(parentStepTypes).toContain('DELEGATION_RESULT');

    const messages = await fetchAgentMessages(rootRun!.id);
    expect(messages.some((message) => message.type === 'REQUEST')).toBe(true);
    expect(messages.some((message) => message.type === 'COMPLETION')).toBe(true);

    const treeResponse = await request(app.getHttpServer())
      .get(`/api/v1/ai/agents/runs/${rootRun!.id}/tree`)
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    const tree = (treeResponse.body as ApiSuccessResponse<AgentRunResponseDto[]>).data;
    expect(tree).toHaveLength(2);
    expect(tree.map((run) => run.id).sort()).toEqual([rootRun!.id, childRun!.id].sort());
  });

  it('delegates to multiple agents in parallel and persists a 3-run execution tree', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);
    const coordinator = await createAgent(accessToken, {
      name: 'Parallel Coordinator',
      systemPrompt: 'PERSONA_PARALLEL_COORDINATOR: You fan work out to specialists.',
    });
    const salesWorker = await createAgent(accessToken, {
      name: 'Sales Worker',
      systemPrompt: 'PERSONA_SALES_WORKER: You summarize sales pipeline data.',
    });
    const supportWorker = await createAgent(accessToken, {
      name: 'Support Worker',
      systemPrompt: 'PERSONA_SUPPORT_WORKER: You summarize support tickets.',
    });
    const conversation = await createConversation(accessToken);

    let coordinatorReasoningCalls = 0;
    jest.spyOn(aiRuntimeService, 'streamChat').mockImplementation((input) => {
      const systemPrompt = input.systemPrompt ?? '';
      if (systemPrompt.includes('planning module')) {
        return chatEventsFor(JSON.stringify({ steps: ['Fan out to specialists'] }));
      }
      if (systemPrompt.includes('PERSONA_PARALLEL_COORDINATOR')) {
        coordinatorReasoningCalls += 1;
        if (coordinatorReasoningCalls === 1) {
          return chatEventsFor(
            JSON.stringify({
              action: 'delegate_parallel',
              thought: 'Fan out to both specialists at once.',
              delegations: [
                { agentName: salesWorker.name, objective: 'Summarize the sales pipeline.' },
                { agentName: supportWorker.name, objective: 'Summarize open support tickets.' },
              ],
            }),
          );
        }
        return chatEventsFor(
          JSON.stringify({ action: 'final_answer', content: 'Combined report ready.' }),
        );
      }
      if (systemPrompt.includes('PERSONA_SALES_WORKER')) {
        return chatEventsFor(
          JSON.stringify({ action: 'final_answer', content: 'Sales pipeline is healthy.' }),
        );
      }
      return chatEventsFor(
        JSON.stringify({ action: 'final_answer', content: 'Support tickets are under control.' }),
      );
    });

    const response = await request(app.getHttpServer())
      .post(`/api/v1/ai/agents/${coordinator.id}/run/autonomous/stream`)
      .set(bearerAuthHeaders(accessToken))
      .send({
        conversationId: conversation.id,
        objective: 'Prepare a combined sales and support report.',
      })
      .expect(200);

    const frames = parseSseFrames(response.text);
    const eventTypes = frames.map((frame) => frame.event);
    expect(eventTypes).toContain('agent_spawned');
    expect(eventTypes).toContain('aggregation');
    expect(eventTypes).toContain('coordinator_finished');
    expect(frames[frames.length - 1]?.event).toBe('done');
    expect(eventTypes.filter((type) => type === 'agent_spawned')).toHaveLength(2);

    const runs = await fetchAgentRuns(conversation.id);
    expect(runs).toHaveLength(3);
    const rootRun = runs.find((run) => run.parentRunId === null);
    const childRuns = runs.filter((run) => run.parentRunId !== null);
    expect(rootRun?.status).toBe('SUCCEEDED');
    expect(childRuns).toHaveLength(2);
    expect(childRuns.every((run) => run.depth === 1 && run.status === 'SUCCEEDED')).toBe(true);
    expect(childRuns.every((run) => run.rootRunId === rootRun?.id)).toBe(true);

    const treeResponse = await request(app.getHttpServer())
      .get(`/api/v1/ai/agents/runs/${rootRun!.id}/tree`)
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    const tree = (treeResponse.body as ApiSuccessResponse<AgentRunResponseDto[]>).data;
    expect(tree).toHaveLength(3);
  });
});
