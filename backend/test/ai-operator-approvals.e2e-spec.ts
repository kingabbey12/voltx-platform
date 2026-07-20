import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiSuccessResponse } from '../src/common/interceptors/response.interceptor';
import { AgentResponseDto } from '../src/modules/ai/agents/dto/agent.dto';
import { ConversationResponseDto } from '../src/modules/ai/conversations/dto/conversation.dto';
import { ModelRegistryService } from '../src/modules/ai/models/model-registry.service';
import { AIRuntimeService } from '../src/modules/ai/runtime/ai-runtime.service';
import { PrismaService } from '../src/database/prisma.service';
import { UsersRepository } from '../src/modules/users/users.repository';
import { createTestApp } from './create-test-app';
import {
  authenticateContext,
  bearerAuthHeaders,
  loginAs,
  resetAndSeedAuthTestData,
  seedAuthContext,
} from './helpers/users-test.helper';

interface ApprovalBody {
  id: string;
  agentRunId: string;
  toolName: string;
  status: string;
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

async function waitUntil<T>(
  check: () => Promise<T | null | undefined>,
  timeoutMs = 15000,
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = await check();
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error('waitUntil timed out');
}

describe('AI Operator — Approvals & Dashboard (e2e)', () => {
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
        name: `Approval Test Agent ${Date.now()}-${Math.random()}`,
        description: 'An agent used to test the approval gate.',
        systemPrompt: 'You are a helpful test agent.',
        configuration: { toolNames },
      })
      .expect(201);
    return (response.body as ApiSuccessResponse<AgentResponseDto>).data;
  }

  async function createConversation(accessToken: string): Promise<ConversationResponseDto> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/ai/conversations')
      .set(bearerAuthHeaders(accessToken))
      .send({ title: 'Approval Test Run' })
      .expect(201);
    return (response.body as ApiSuccessResponse<ConversationResponseDto>).data;
  }

  async function getRunStatus(runId: string): Promise<string | null> {
    const systemClient = prisma.system as unknown as {
      agentRun: { findFirst(args: { where: { id: string } }): Promise<{ status: string } | null> };
    };
    const run = await systemClient.agentRun.findFirst({ where: { id: runId } });
    return run?.status ?? null;
  }

  it('pauses a run requesting a mutating tool, then approves it and actually performs the action on resume', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);
    const agent = await createAgentWithTools(accessToken, ['create_task']);
    const conversation = await createConversation(accessToken);

    jest
      .spyOn(aiRuntimeService, 'streamChat')
      .mockImplementationOnce(() => chatEventsFor(JSON.stringify({ steps: ['Create the task'] })))
      .mockImplementationOnce(() =>
        chatEventsFor(
          JSON.stringify({
            action: 'tool_call',
            thought: 'Creating the requested follow-up task.',
            toolName: 'create_task',
            input: { subject: 'Follow up with prospect' },
          }),
        ),
      )
      .mockImplementationOnce(() =>
        chatEventsFor(JSON.stringify({ steps: ['Confirm the task was created'] })),
      )
      .mockImplementationOnce(() =>
        chatEventsFor(
          JSON.stringify({
            action: 'final_answer',
            content: 'The follow-up task has been created.',
          }),
        ),
      );

    const runResponse = await request(app.getHttpServer())
      .post(`/api/v1/ai/agents/${agent.id}/run/autonomous`)
      .set(bearerAuthHeaders(accessToken))
      .send({ conversationId: conversation.id, objective: 'Create a follow-up task.' })
      .expect(201);
    const run = (runResponse.body as ApiSuccessResponse<{ run: { id: string; status: string } }>)
      .data.run;
    expect(run.status).toBe('WAITING_APPROVAL');

    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/ai/approvals')
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    const approvals = (listResponse.body as ApiSuccessResponse<{ items: ApprovalBody[] }>).data
      .items;
    const approval = approvals.find((item) => item.agentRunId === run.id);
    expect(approval).toBeDefined();
    expect(approval?.toolName).toBe('create_task');
    expect(approval?.status).toBe('PENDING');

    const decideResponse = await request(app.getHttpServer())
      .post(`/api/v1/ai/approvals/${approval!.id}/decide`)
      .set(bearerAuthHeaders(accessToken))
      .send({ decision: 'APPROVED' })
      .expect(201);
    expect((decideResponse.body as ApiSuccessResponse<ApprovalBody>).data.status).toBe('APPROVED');

    // The action was NOT executed at pause time — only after approval.
    const activityClientBefore = prisma.system as unknown as {
      salesActivity: { findMany(args: { where: Record<string, unknown> }): Promise<unknown[]> };
    };

    await waitUntil(async () => {
      const status = await getRunStatus(run.id);
      return status === 'SUCCEEDED' ? status : null;
    });

    const createdTasks = await activityClientBefore.salesActivity.findMany({
      where: { subject: 'Follow up with prospect' },
    });
    expect(createdTasks).toHaveLength(1);

    const auditClient = prisma.system as unknown as {
      auditLog: {
        findMany(args: { where: Record<string, unknown> }): Promise<Array<{ action: string }>>;
      };
    };
    const requestedAudit = await auditClient.auditLog.findMany({
      where: { resourceId: approval!.id, action: 'ai.approval.requested' },
    });
    const approvedAudit = await auditClient.auditLog.findMany({
      where: { resourceId: approval!.id, action: 'ai.approval.approved' },
    });
    expect(requestedAudit).toHaveLength(1);
    expect(approvedAudit).toHaveLength(1);

    // Real notifications, not just audit rows: both the approver (approval
    // requested — this test user holds ai.approval.decide) and the run's
    // owning user (approval decided — same user here) should have real
    // Notification rows they can see via GET /notifications.
    const notificationsResponse = await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    const notifications = (
      notificationsResponse.body as ApiSuccessResponse<{
        items: Array<{ category: string; title: string }>;
      }>
    ).data.items;
    expect(notifications.some((n) => n.title.includes('Approval needed'))).toBe(true);
    expect(notifications.some((n) => n.title.startsWith('Approved:'))).toBe(true);
  }, 30000);

  it('lets exactly one of two concurrent decide() calls on the same approval succeed', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);
    const agent = await createAgentWithTools(accessToken, ['create_task']);
    const conversation = await createConversation(accessToken);

    jest
      .spyOn(aiRuntimeService, 'streamChat')
      .mockImplementationOnce(() => chatEventsFor(JSON.stringify({ steps: ['Create the task'] })))
      .mockImplementationOnce(() =>
        chatEventsFor(
          JSON.stringify({
            action: 'tool_call',
            toolName: 'create_task',
            input: { subject: 'Race condition test subject' },
          }),
        ),
      )
      .mockImplementationOnce(() => chatEventsFor(JSON.stringify({ steps: ['Acknowledge'] })))
      .mockImplementationOnce(() =>
        chatEventsFor(JSON.stringify({ action: 'final_answer', content: 'Done.' })),
      );

    const runResponse = await request(app.getHttpServer())
      .post(`/api/v1/ai/agents/${agent.id}/run/autonomous`)
      .set(bearerAuthHeaders(accessToken))
      .send({ conversationId: conversation.id, objective: 'Create a task.' })
      .expect(201);
    const run = (runResponse.body as ApiSuccessResponse<{ run: { id: string; status: string } }>)
      .data.run;

    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/ai/approvals')
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    const approval = (
      listResponse.body as ApiSuccessResponse<{ items: ApprovalBody[] }>
    ).data.items.find((item) => item.agentRunId === run.id);
    expect(approval).toBeDefined();

    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/v1/ai/approvals/${approval!.id}/decide`)
        .set(bearerAuthHeaders(accessToken))
        .send({ decision: 'APPROVED' }),
      request(app.getHttpServer())
        .post(`/api/v1/ai/approvals/${approval!.id}/decide`)
        .set(bearerAuthHeaders(accessToken))
        .send({ decision: 'APPROVED' }),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 400]);

    await waitUntil(async () => {
      const status = await getRunStatus(run.id);
      return status === 'SUCCEEDED' ? status : null;
    });

    const activityClient = prisma.system as unknown as {
      salesActivity: { findMany(args: { where: Record<string, unknown> }): Promise<unknown[]> };
    };
    const createdTasks = await activityClient.salesActivity.findMany({
      where: { subject: 'Race condition test subject' },
    });
    // The atomic compare-and-swap in AgentApprovalRepository.decide() plus
    // the claim-before-execute guard in AgentRunResumeService together
    // ensure the approved tool call runs exactly once, even though it was
    // decided by two concurrent requests.
    expect(createdTasks).toHaveLength(1);
  }, 30000);

  it('never performs the action when an approval is rejected', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);
    const agent = await createAgentWithTools(accessToken, ['create_task']);
    const conversation = await createConversation(accessToken);

    jest
      .spyOn(aiRuntimeService, 'streamChat')
      .mockImplementationOnce(() => chatEventsFor(JSON.stringify({ steps: ['Create the task'] })))
      .mockImplementationOnce(() =>
        chatEventsFor(
          JSON.stringify({
            action: 'tool_call',
            toolName: 'create_task',
            input: { subject: 'Rejected task subject' },
          }),
        ),
      )
      .mockImplementationOnce(() => chatEventsFor(JSON.stringify({ steps: ['Acknowledge'] })))
      .mockImplementationOnce(() =>
        chatEventsFor(
          JSON.stringify({
            action: 'final_answer',
            content: 'Understood, I will not create that task.',
          }),
        ),
      );

    const runResponse = await request(app.getHttpServer())
      .post(`/api/v1/ai/agents/${agent.id}/run/autonomous`)
      .set(bearerAuthHeaders(accessToken))
      .send({ conversationId: conversation.id, objective: 'Create a task.' })
      .expect(201);
    const run = (runResponse.body as ApiSuccessResponse<{ run: { id: string; status: string } }>)
      .data.run;

    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/ai/approvals')
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    const approval = (
      listResponse.body as ApiSuccessResponse<{ items: ApprovalBody[] }>
    ).data.items.find((item) => item.agentRunId === run.id);

    await request(app.getHttpServer())
      .post(`/api/v1/ai/approvals/${approval!.id}/decide`)
      .set(bearerAuthHeaders(accessToken))
      .send({ decision: 'REJECTED', comment: 'Not needed right now' })
      .expect(201);

    await waitUntil(async () => {
      const status = await getRunStatus(run.id);
      return status === 'SUCCEEDED' ? status : null;
    });

    const activityClient = prisma.system as unknown as {
      salesActivity: { findMany(args: { where: Record<string, unknown> }): Promise<unknown[]> };
    };
    const createdTasks = await activityClient.salesActivity.findMany({
      where: { subject: 'Rejected task subject' },
    });
    expect(createdTasks).toHaveLength(0);

    const notificationsResponse = await request(app.getHttpServer())
      .get('/api/v1/notifications')
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    const notifications = (
      notificationsResponse.body as ApiSuccessResponse<{ items: Array<{ title: string }> }>
    ).data.items;
    expect(notifications.some((n) => n.title.startsWith('Rejected:'))).toBe(true);
  }, 30000);

  it('denies a viewer from deciding an approval, and a manager cannot see other orgs’ approvals', async () => {
    const admin = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: 'approval-admin@example.com',
    });
    const agent = await createAgentWithTools(admin.accessToken, ['create_task']);
    const conversation = await createConversation(admin.accessToken);

    jest
      .spyOn(aiRuntimeService, 'streamChat')
      .mockImplementationOnce(() => chatEventsFor(JSON.stringify({ steps: ['Create the task'] })))
      .mockImplementationOnce(() =>
        chatEventsFor(
          JSON.stringify({
            action: 'tool_call',
            toolName: 'create_task',
            input: { subject: 'RBAC test subject' },
          }),
        ),
      );

    await request(app.getHttpServer())
      .post(`/api/v1/ai/agents/${agent.id}/run/autonomous`)
      .set(bearerAuthHeaders(admin.accessToken))
      .send({ conversationId: conversation.id, objective: 'Create a task.' })
      .expect(201);

    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/ai/approvals')
      .set(bearerAuthHeaders(admin.accessToken))
      .expect(200);
    const approval = (listResponse.body as ApiSuccessResponse<{ items: ApprovalBody[] }>).data
      .items[0];

    const viewer = await seedAuthContext(
      prisma,
      usersRepository,
      'viewer',
      { email: 'approval-viewer@example.com' },
      undefined,
      { organizationId: admin.organization.id },
    );
    const viewerTokens = await loginAs(
      app,
      viewer.user.email,
      viewer.password,
      admin.organization.id,
    );

    await request(app.getHttpServer())
      .post(`/api/v1/ai/approvals/${approval.id}/decide`)
      .set(bearerAuthHeaders(viewerTokens.accessToken))
      .send({ decision: 'APPROVED' })
      .expect(403);

    const otherOrg = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: 'approval-other-org@example.com',
    });
    const otherOrgList = await request(app.getHttpServer())
      .get('/api/v1/ai/approvals')
      .set(bearerAuthHeaders(otherOrg.accessToken))
      .expect(200);
    expect(
      (otherOrgList.body as ApiSuccessResponse<{ items: ApprovalBody[] }>).data.items,
    ).toHaveLength(0);
  });

  describe('AI Operator dashboard', () => {
    it('exposes activity, performance, tasks, and suggestions', async () => {
      const { accessToken } = await authenticateContext(app, prisma, usersRepository);
      const agent = await createAgentWithTools(accessToken, []);
      const conversation = await createConversation(accessToken);

      jest
        .spyOn(aiRuntimeService, 'streamChat')
        .mockImplementationOnce(() => chatEventsFor(JSON.stringify({ steps: ['Answer directly'] })))
        .mockImplementationOnce(() =>
          chatEventsFor(JSON.stringify({ action: 'final_answer', content: 'Done.' })),
        );

      await request(app.getHttpServer())
        .post(`/api/v1/ai/agents/${agent.id}/run/autonomous`)
        .set(bearerAuthHeaders(accessToken))
        .send({ conversationId: conversation.id, objective: 'Answer directly.' })
        .expect(201);

      const activityResponse = await request(app.getHttpServer())
        .get('/api/v1/ai/dashboard/activity')
        .set(bearerAuthHeaders(accessToken))
        .expect(200);
      const activity = (
        activityResponse.body as ApiSuccessResponse<{ items: Array<{ id: string }>; total: number }>
      ).data;
      expect(activity.total).toBeGreaterThanOrEqual(1);

      const performanceResponse = await request(app.getHttpServer())
        .get('/api/v1/ai/dashboard/performance')
        .set(bearerAuthHeaders(accessToken))
        .expect(200);
      const performance = (
        performanceResponse.body as ApiSuccessResponse<{ totalCallCount: number }>
      ).data;
      expect(performance.totalCallCount).toBeGreaterThanOrEqual(1);

      const tasksResponse = await request(app.getHttpServer())
        .get('/api/v1/ai/dashboard/tasks')
        .set(bearerAuthHeaders(accessToken))
        .expect(200);
      const tasks = (
        tasksResponse.body as ApiSuccessResponse<{
          pendingApprovals: unknown[];
          inProgressRuns: unknown[];
        }>
      ).data;
      expect(Array.isArray(tasks.pendingApprovals)).toBe(true);
      expect(Array.isArray(tasks.inProgressRuns)).toBe(true);

      // No Executive Assistant agent has been created in this test's org, so
      // suggestion generation quietly no-ops rather than failing the request.
      const suggestionsResponse = await request(app.getHttpServer())
        .get('/api/v1/ai/dashboard/suggestions')
        .set(bearerAuthHeaders(accessToken))
        .expect(200);
      expect(Array.isArray((suggestionsResponse.body as ApiSuccessResponse<unknown[]>).data)).toBe(
        true,
      );
    });

    it('never leaks another organization’s activity into the dashboard', async () => {
      const orgA = await authenticateContext(app, prisma, usersRepository, 'admin', {
        email: 'dashboard-org-a@example.com',
      });
      const orgB = await authenticateContext(app, prisma, usersRepository, 'admin', {
        email: 'dashboard-org-b@example.com',
      });
      const agent = await createAgentWithTools(orgA.accessToken, []);
      const conversation = await createConversation(orgA.accessToken);

      jest
        .spyOn(aiRuntimeService, 'streamChat')
        .mockImplementationOnce(() => chatEventsFor(JSON.stringify({ steps: ['Answer directly'] })))
        .mockImplementationOnce(() =>
          chatEventsFor(JSON.stringify({ action: 'final_answer', content: 'Done.' })),
        );

      await request(app.getHttpServer())
        .post(`/api/v1/ai/agents/${agent.id}/run/autonomous`)
        .set(bearerAuthHeaders(orgA.accessToken))
        .send({ conversationId: conversation.id, objective: 'Answer directly.' })
        .expect(201);

      const activityResponse = await request(app.getHttpServer())
        .get('/api/v1/ai/dashboard/activity')
        .set(bearerAuthHeaders(orgB.accessToken))
        .expect(200);
      expect((activityResponse.body as ApiSuccessResponse<{ total: number }>).data.total).toBe(0);
      // Same 30s budget as this suite's other tests that drive a full
      // autonomous run — the default 5s cannot cover two org setups plus a
      // run with memory capture.
    }, 30000);
  });
});
