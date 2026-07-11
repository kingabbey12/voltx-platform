import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiSuccessResponse } from '../src/common/interceptors/response.interceptor';
import { AIEmbeddingRequest, AIEmbeddingResponse } from '../src/modules/ai/models/ai-model.types';
import { ModelRegistryService } from '../src/modules/ai/models/model-registry.service';
import { AIRuntimeService } from '../src/modules/ai/runtime/ai-runtime.service';
import { WorkflowEventBusService } from '../src/modules/workflows/scheduling/workflow-event-bus.service';
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('Workflow Engine (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let usersRepository: UsersRepository;
  let modelRegistryService: ModelRegistryService;
  let aiRuntimeService: AIRuntimeService;
  let workflowEventBusService: WorkflowEventBusService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    usersRepository = app.get(UsersRepository);
    modelRegistryService = app.get(ModelRegistryService);
    aiRuntimeService = app.get(AIRuntimeService);
    workflowEventBusService = app.get(WorkflowEventBusService);
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

  async function createAgent(accessToken: string, name: string, systemPrompt: string) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/ai/agents')
      .set(bearerAuthHeaders(accessToken))
      .send({
        name: `${name} ${Date.now()}-${Math.random()}`,
        description: `${name} test agent.`,
        systemPrompt,
        configuration: { toolNames: [] },
      })
      .expect(201);
    return (response.body as ApiSuccessResponse<{ id: string; name: string }>).data;
  }

  async function createWorkflow(accessToken: string, name: string, definition: unknown) {
    const response = await request(app.getHttpServer())
      .post('/api/v1/workflows')
      .set(bearerAuthHeaders(accessToken))
      .send({ name: `${name} ${Date.now()}-${Math.random()}`, definition })
      .expect(201);
    return (response.body as ApiSuccessResponse<{ id: string; name: string }>).data;
  }

  async function publishWorkflow(accessToken: string, workflowId: string) {
    await request(app.getHttpServer())
      .post(`/api/v1/workflows/${workflowId}/publish`)
      .set(bearerAuthHeaders(accessToken))
      .expect(201);
  }

  async function createAndPublish(accessToken: string, name: string, definition: unknown) {
    const workflow = await createWorkflow(accessToken, name, definition);
    await publishWorkflow(accessToken, workflow.id);
    return workflow;
  }

  function toolStep(id: string, overrides: Record<string, unknown> = {}) {
    return {
      id,
      name: id,
      type: 'TOOL',
      config: { toolName: 'datetime', input: {} },
      ...overrides,
    };
  }

  interface RunResponse {
    id: string;
    status: string;
    context: Record<string, unknown>;
    output: Record<string, unknown>;
    error: string | null;
  }

  async function runWorkflow(
    accessToken: string,
    workflowId: string,
    body: Record<string, unknown> = {},
  ): Promise<RunResponse> {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/workflows/${workflowId}/run`)
      .set(bearerAuthHeaders(accessToken))
      .send(body)
      .expect(201);
    return (response.body as ApiSuccessResponse<RunResponse>).data;
  }

  async function getRun(accessToken: string, runId: string): Promise<RunResponse> {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/workflows/runs/${runId}`)
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    return (response.body as ApiSuccessResponse<RunResponse>).data;
  }

  it('creates, publishes, and runs a simple sequential workflow to completion', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);
    const workflow = await createAndPublish(accessToken, 'Sequential', {
      steps: [toolStep('first'), toolStep('second', { dependsOn: ['first'] })],
    });

    const run = await runWorkflow(accessToken, workflow.id);

    expect(run.status).toBe('SUCCEEDED');
    expect(run.context).toHaveProperty('first');
    expect(run.context).toHaveProperty('second');
  });

  it('runs a workflow with no AGENT steps to completion when no AI provider is enabled', async () => {
    // Regression test: every run creates a bookkeeping Conversation
    // up front (see WorkflowService.createRunConversation), which used to
    // unconditionally resolve a real AI provider/model even when the
    // workflow has zero AGENT steps and will never touch that conversation
    // — failing with "No AI providers are enabled" for pure automation
    // workflows on any org that hasn't configured AI yet (the e2e/test env
    // itself has no *_ENABLED provider set, so this exercises that exact
    // scenario).
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);
    const workflow = await createAndPublish(accessToken, 'NoAiProviderNeeded', {
      steps: [{ id: 'wait', name: 'Wait', type: 'DELAY', config: { delayMs: 10 } }],
    });

    const run = await runWorkflow(accessToken, workflow.id);

    expect(run.status).toBe('SUCCEEDED');
    expect(run.context).toHaveProperty('wait');
  });

  it('runs independent parallel branches and merges their outputs into context', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);
    const workflow = await createAndPublish(accessToken, 'Parallel', {
      steps: [
        toolStep('start'),
        toolStep('branch-a', { dependsOn: ['start'] }),
        toolStep('branch-b', { dependsOn: ['start'] }),
        toolStep('join', { dependsOn: ['branch-a', 'branch-b'] }),
      ],
    });

    const run = await runWorkflow(accessToken, workflow.id);

    expect(run.status).toBe('SUCCEEDED');
    expect(Object.keys(run.context).sort()).toEqual(['branch-a', 'branch-b', 'join', 'start']);
  });

  it('skips a step whose condition is false and still completes the run', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);
    const workflow = await createAndPublish(accessToken, 'Conditional', {
      steps: [
        toolStep('gate', {
          condition: { path: 'input.proceed', operator: 'truthy' },
        }),
      ],
    });

    const skippedRun = await runWorkflow(accessToken, workflow.id, { input: { proceed: false } });
    expect(skippedRun.status).toBe('SUCCEEDED');
    expect(skippedRun.context).not.toHaveProperty('gate');

    const executedRun = await runWorkflow(accessToken, workflow.id, { input: { proceed: true } });
    expect(executedRun.status).toBe('SUCCEEDED');
    expect(executedRun.context).toHaveProperty('gate');
  });

  it('retries a failing step and eventually dead-letters it after exhausting attempts, failing the run', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);
    const workflow = await createAndPublish(accessToken, 'RetryAndFail', {
      steps: [
        {
          id: 'unreachable',
          name: 'Unreachable call',
          type: 'TOOL',
          config: { toolName: 'http_get', input: { url: 'http://127.0.0.1:1/' } },
          retryPolicy: { maxAttempts: 2, backoffMs: 10 },
        },
      ],
    });

    const run = await runWorkflow(accessToken, workflow.id);

    expect(run.status).toBe('FAILED');
    expect(run.error).toBeTruthy();

    const deadLettersResponse = await request(app.getHttpServer())
      .get('/api/v1/workflows/dead-letters')
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    const deadLetters = (
      deadLettersResponse.body as ApiSuccessResponse<{ items: Array<{ stepId: string }> }>
    ).data.items;
    expect(deadLetters.some((item) => item.stepId === 'unreachable')).toBe(true);

    const logsResponse = await request(app.getHttpServer())
      .get(`/api/v1/workflows/runs/${run.id}/logs`)
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    const logs = (logsResponse.body as ApiSuccessResponse<{ items: Array<{ event: string }> }>).data
      .items;
    expect(logs.some((log) => log.event === 'WorkflowFailed')).toBe(true);
  });

  it('pauses at an approval step (WAITING_APPROVAL) and completes once approved', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);
    const workflow = await createAndPublish(accessToken, 'Approval', {
      steps: [{ id: 'approve', name: 'Approve', type: 'APPROVAL', config: { message: 'OK?' } }],
    });

    const run = await runWorkflow(accessToken, workflow.id);
    expect(run.status).toBe('WAITING_APPROVAL');

    const systemClient = prisma.system as unknown as {
      workflowApproval: {
        findFirst(args: { where: { workflowRunId: string } }): Promise<{ id: string } | null>;
      };
    };
    const approval = await systemClient.workflowApproval.findFirst({
      where: { workflowRunId: run.id },
    });
    expect(approval).not.toBeNull();

    const decideResponse = await request(app.getHttpServer())
      .post(`/api/v1/workflows/approvals/${approval!.id}/decide`)
      .set(bearerAuthHeaders(accessToken))
      .send({ decision: 'APPROVED', comment: 'Looks good' })
      .expect(201);
    expect((decideResponse.body as ApiSuccessResponse<{ status: string }>).data.status).toBe(
      'APPROVED',
    );

    const finalRun = await getRun(accessToken, run.id);
    expect(finalRun.status).toBe('SUCCEEDED');
  });

  it('rejects an approval and the run fails', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);
    const workflow = await createAndPublish(accessToken, 'Rejection', {
      steps: [{ id: 'approve', name: 'Approve', type: 'APPROVAL', config: { message: 'OK?' } }],
    });

    const run = await runWorkflow(accessToken, workflow.id);
    const systemClient = prisma.system as unknown as {
      workflowApproval: {
        findFirst(args: { where: { workflowRunId: string } }): Promise<{ id: string } | null>;
      };
    };
    const approval = await systemClient.workflowApproval.findFirst({
      where: { workflowRunId: run.id },
    });

    await request(app.getHttpServer())
      .post(`/api/v1/workflows/approvals/${approval!.id}/decide`)
      .set(bearerAuthHeaders(accessToken))
      .send({ decision: 'REJECTED', comment: 'Not now' })
      .expect(201);

    const finalRun = await getRun(accessToken, run.id);
    expect(finalRun.status).toBe('FAILED');
  });

  it('cancels an in-flight run via the streaming endpoint and stops before later steps run', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);
    const workflow = await createAndPublish(accessToken, 'Cancellable', {
      steps: [
        { id: 'wait', name: 'Wait', type: 'DELAY', config: { delayMs: 2000 } },
        toolStep('after', { dependsOn: ['wait'] }),
      ],
    });

    // supertest's Test object doesn't dispatch until awaited/`.then()`-ed —
    // wrapping in an async IIFE with an `await` *inside* the body forces
    // immediate dispatch (JS runs an async function body synchronously up
    // to its first await) while still letting us hold a promise to await
    // later, running concurrently with the pause/cancel request below.
    const streamPromise = (async () =>
      await request(app.getHttpServer())
        .post(`/api/v1/workflows/${workflow.id}/run/stream`)
        .set(bearerAuthHeaders(accessToken))
        .send({}))();

    await delay(200);

    const runsResponse = await request(app.getHttpServer())
      .get(`/api/v1/workflows/${workflow.id}/runs`)
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    const runs = (runsResponse.body as ApiSuccessResponse<{ items: Array<{ id: string }> }>).data
      .items;
    expect(runs.length).toBeGreaterThan(0);
    const runId = runs[0].id;

    await request(app.getHttpServer())
      .post(`/api/v1/workflows/runs/${runId}/cancel`)
      .set(bearerAuthHeaders(accessToken))
      .expect(201);

    await streamPromise;

    const finalRun = await getRun(accessToken, runId);
    expect(finalRun.status).toBe('CANCELLED');
  }, 15000);

  it('checkpoints progress and resumes correctly after an explicit pause', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);
    const workflow = await createAndPublish(accessToken, 'PauseResume', {
      steps: [
        { id: 'wait', name: 'Wait', type: 'DELAY', config: { delayMs: 500 } },
        toolStep('after', { dependsOn: ['wait'] }),
      ],
    });

    const streamPromise = (async () =>
      await request(app.getHttpServer())
        .post(`/api/v1/workflows/${workflow.id}/run/stream`)
        .set(bearerAuthHeaders(accessToken))
        .send({}))();

    await delay(100);
    const runsResponse = await request(app.getHttpServer())
      .get(`/api/v1/workflows/${workflow.id}/runs`)
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    const runId = (runsResponse.body as ApiSuccessResponse<{ items: Array<{ id: string }> }>).data
      .items[0].id;

    await request(app.getHttpServer())
      .post(`/api/v1/workflows/runs/${runId}/pause`)
      .set(bearerAuthHeaders(accessToken))
      .expect(201);

    await streamPromise;

    const pausedRun = await getRun(accessToken, runId);
    expect(pausedRun.status).toBe('PAUSED');
    expect(pausedRun.context).toHaveProperty('wait');
    expect(pausedRun.context).not.toHaveProperty('after');

    const checkpointsResponse = await request(app.getHttpServer())
      .get(`/api/v1/workflows/runs/${runId}/checkpoints`)
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    const checkpoints = (checkpointsResponse.body as ApiSuccessResponse<Array<{ stepId: string }>>)
      .data;
    expect(checkpoints.some((checkpoint) => checkpoint.stepId === 'wait')).toBe(true);

    const resumeResponse = await request(app.getHttpServer())
      .post(`/api/v1/workflows/runs/${runId}/resume`)
      .set(bearerAuthHeaders(accessToken))
      .expect(201);
    expect((resumeResponse.body as ApiSuccessResponse<RunResponse>).data.status).toBe('SUCCEEDED');
  }, 15000);

  it('runs an AGENT step through the full autonomous loop, including multi-agent delegation', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);
    const coordinator = await createAgent(
      accessToken,
      'Workflow Coordinator',
      'PERSONA_COORDINATOR: You orchestrate other specialist agents.',
    );
    const specialist = await createAgent(
      accessToken,
      'Workflow Specialist',
      'PERSONA_SPECIALIST: You summarize sales pipeline data.',
    );

    let coordinatorCalls = 0;
    jest.spyOn(aiRuntimeService, 'streamChat').mockImplementation((input) => {
      const systemPrompt = input.systemPrompt ?? '';
      if (systemPrompt.includes('planning module')) {
        return chatEventsFor(JSON.stringify({ steps: ['Delegate and summarize'] }));
      }
      if (systemPrompt.includes('PERSONA_COORDINATOR')) {
        coordinatorCalls += 1;
        if (coordinatorCalls === 1) {
          return chatEventsFor(
            JSON.stringify({
              action: 'delegate',
              thought: 'Need the specialist.',
              agentName: specialist.name,
              objective: 'Summarize the pipeline.',
            }),
          );
        }
        return chatEventsFor(
          JSON.stringify({ action: 'final_answer', content: 'Done via delegate.' }),
        );
      }
      return chatEventsFor(
        JSON.stringify({ action: 'final_answer', content: 'Pipeline summarized.' }),
      );
    });

    const workflow = await createAndPublish(accessToken, 'AgentWorkflow', {
      steps: [
        {
          id: 'summarize',
          name: 'Summarize',
          type: 'AGENT',
          config: { agentName: coordinator.name, objective: 'Prepare an executive summary.' },
        },
      ],
    });

    const run = await runWorkflow(accessToken, workflow.id);

    expect(run.status).toBe('SUCCEEDED');
    const summarizeOutput = run.context.summarize as { outputText: string };
    expect(summarizeOutput.outputText).toBe('Done via delegate.');

    const systemClient = prisma.system as unknown as {
      agentRun: {
        findMany(args: {
          where: { conversationId: string };
        }): Promise<Array<{ parentRunId: string | null }>>;
      };
    };
    const agentRuns = await systemClient.agentRun.findMany({
      where: {
        conversationId: run.output
          ? (run as unknown as { conversationId: string }).conversationId
          : '',
      },
    });
    void agentRuns;
  });

  it('injects knowledge context automatically into an AGENT step (Gateway auto-injection, no workflow-specific retrieval code)', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);

    jest
      .spyOn(aiRuntimeService, 'embeddings')
      .mockImplementation((input: Pick<AIEmbeddingRequest, 'input'>) =>
        Promise.resolve({
          provider: 'openai',
          model: 'text-embedding-3-small',
          vectors: input.input.map(() => new Array(1536).fill(0).map((_, i) => (i === 0 ? 1 : 0))),
        } as AIEmbeddingResponse),
      );

    const sourceResponse = await request(app.getHttpServer())
      .post('/api/v1/knowledge/sources')
      .set(bearerAuthHeaders(accessToken))
      .send({ type: 'DOCUMENT', name: 'Workflow Knowledge Source' })
      .expect(201);
    const source = (sourceResponse.body as ApiSuccessResponse<{ id: string }>).data;

    await request(app.getHttpServer())
      .post(`/api/v1/knowledge/sources/${source.id}/documents`)
      .set(bearerAuthHeaders(accessToken))
      .send({
        title: 'Acme Deal Notes',
        contentType: 'text',
        text: 'The Acme Corp pipeline deal is worth two hundred thousand dollars.',
      })
      .expect(201);

    const agent = await createAgent(
      accessToken,
      'Knowledge Agent',
      'You answer questions about deals.',
    );

    let capturedWorkspaceContext: string[] | undefined;
    jest.spyOn(aiRuntimeService, 'streamChat').mockImplementation((input) => {
      if ((input.systemPrompt ?? '').includes('planning module')) {
        return chatEventsFor(JSON.stringify({ steps: ['Answer using context'] }));
      }
      capturedWorkspaceContext = input.workspaceContext;
      return chatEventsFor(JSON.stringify({ action: 'final_answer', content: 'Acknowledged.' }));
    });

    const workflow = await createAndPublish(accessToken, 'KnowledgeWorkflow', {
      steps: [
        {
          id: 'answer',
          name: 'Answer',
          type: 'AGENT',
          config: { agentName: agent.name, objective: 'What is the Acme pipeline deal worth?' },
        },
      ],
    });

    const run = await runWorkflow(accessToken, workflow.id);

    expect(run.status).toBe('SUCCEEDED');
    expect(capturedWorkspaceContext?.some((entry) => entry.includes('Acme Corp'))).toBe(true);
  });

  it('streams the full lifecycle event sequence for a run', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);
    const workflow = await createAndPublish(accessToken, 'Streamed', {
      steps: [toolStep('only')],
    });

    const response = await request(app.getHttpServer())
      .post(`/api/v1/workflows/${workflow.id}/run/stream`)
      .set(bearerAuthHeaders(accessToken))
      .send({})
      .expect(200);

    const frames = parseSseFrames(response.text);
    const eventTypes = frames.map((frame) => frame.event);

    expect(eventTypes).toEqual([
      'workflow_started',
      'step_started',
      'step_completed',
      'workflow_completed',
      'done',
    ]);
  });

  it('fires an EVENT-triggered schedule when the matching event is emitted', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);
    const workflow = await createAndPublish(accessToken, 'EventTriggered', {
      steps: [toolStep('only')],
    });

    await request(app.getHttpServer())
      .post(`/api/v1/workflows/${workflow.id}/schedules`)
      .set(bearerAuthHeaders(accessToken))
      .send({ triggerType: 'EVENT', eventName: 'test.workflow.trigger' })
      .expect(201);

    workflowEventBusService.emit('test.workflow.trigger', { source: 'e2e-test' });

    let runs: Array<{ id: string; status: string }> = [];
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const runsResponse = await request(app.getHttpServer())
        .get(`/api/v1/workflows/${workflow.id}/runs`)
        .set(bearerAuthHeaders(accessToken))
        .expect(200);
      runs = (
        runsResponse.body as ApiSuccessResponse<{ items: Array<{ id: string; status: string }> }>
      ).data.items;
      if (runs.length > 0 && runs[0].status !== 'PENDING' && runs[0].status !== 'RUNNING') {
        break;
      }
      await delay(100);
    }

    expect(runs.length).toBeGreaterThan(0);
    expect(runs[0].status).toBe('SUCCEEDED');
  }, 10000);

  it('never returns another organization’s workflows or runs (organization isolation)', async () => {
    const orgA = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: 'workflow-org-a@example.com',
    });
    const orgB = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: 'workflow-org-b@example.com',
    });

    const workflowA = await createAndPublish(orgA.accessToken, 'OrgA Workflow', {
      steps: [toolStep('only')],
    });

    await request(app.getHttpServer())
      .get(`/api/v1/workflows/${workflowA.id}`)
      .set(bearerAuthHeaders(orgB.accessToken))
      .expect(404);

    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/workflows')
      .set(bearerAuthHeaders(orgB.accessToken))
      .expect(200);
    const items = (listResponse.body as ApiSuccessResponse<{ items: Array<{ name: string }> }>).data
      .items;
    expect(items.every((item) => item.name !== workflowA.name)).toBe(true);
  });

  it('never returns another organization’s run logs or checkpoints, even when the run id is known', async () => {
    const orgA = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: 'workflow-logs-org-a@example.com',
    });
    const orgB = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: 'workflow-logs-org-b@example.com',
    });

    const workflowA = await createAndPublish(orgA.accessToken, 'OrgA Checkpointed Workflow', {
      steps: [toolStep('first'), toolStep('second', { dependsOn: ['first'] })],
    });
    const run = await runWorkflow(orgA.accessToken, workflowA.id);
    expect(run.status).toBe('SUCCEEDED');

    // Org A (the actual owner) can read its own run's logs and checkpoints.
    const logsAsOrgA = await request(app.getHttpServer())
      .get(`/api/v1/workflows/runs/${run.id}/logs`)
      .set(bearerAuthHeaders(orgA.accessToken))
      .expect(200);
    expect(
      (logsAsOrgA.body as ApiSuccessResponse<{ items: unknown[] }>).data.items.length,
    ).toBeGreaterThan(0);

    const checkpointsAsOrgA = await request(app.getHttpServer())
      .get(`/api/v1/workflows/runs/${run.id}/checkpoints`)
      .set(bearerAuthHeaders(orgA.accessToken))
      .expect(200);
    expect((checkpointsAsOrgA.body as ApiSuccessResponse<unknown[]>).data.length).toBeGreaterThan(
      0,
    );

    // Org B, given the exact same run id, must see nothing — this is the
    // cross-tenant leak this sprint closes (WorkflowLogRepository.listByRun
    // / WorkflowCheckpointRepository.listByRun previously had no
    // organizationId filter at all).
    const logsAsOrgB = await request(app.getHttpServer())
      .get(`/api/v1/workflows/runs/${run.id}/logs`)
      .set(bearerAuthHeaders(orgB.accessToken))
      .expect(200);
    expect((logsAsOrgB.body as ApiSuccessResponse<{ items: unknown[] }>).data.items).toHaveLength(
      0,
    );

    const checkpointsAsOrgB = await request(app.getHttpServer())
      .get(`/api/v1/workflows/runs/${run.id}/checkpoints`)
      .set(bearerAuthHeaders(orgB.accessToken))
      .expect(200);
    expect((checkpointsAsOrgB.body as ApiSuccessResponse<unknown[]>).data).toHaveLength(0);
  });

  it('executes a large workflow (many sequential steps) correctly', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);
    const stepCount = 25;
    const steps = Array.from({ length: stepCount }, (_, index) =>
      toolStep(`step-${index}`, index > 0 ? { dependsOn: [`step-${index - 1}`] } : {}),
    );

    const workflow = await createAndPublish(accessToken, 'LargeWorkflow', { steps });
    const run = await runWorkflow(accessToken, workflow.id);

    expect(run.status).toBe('SUCCEEDED');
    expect(Object.keys(run.context)).toHaveLength(stepCount);
  }, 30000);
});
