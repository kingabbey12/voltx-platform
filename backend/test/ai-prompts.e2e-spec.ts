import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiSuccessResponse } from '../src/common/interceptors/response.interceptor';
import { PrismaService } from '../src/database/prisma.service';
import { TenantContextService } from '../src/common/tenant/tenant-context.service';
import { UsersRepository } from '../src/modules/users/users.repository';
import { AIGatewayService } from '../src/modules/ai/gateway/ai-gateway.service';
import { AIRuntimeService } from '../src/modules/ai/runtime/ai-runtime.service';
import { KnowledgeRetrieverService } from '../src/modules/ai/gateway/knowledge-retriever.service';
import { PromptResolverService } from '../src/modules/ai/prompts/prompt-resolver.service';
import { AIRuntimeChatInput, AIStreamEvent } from '../src/modules/ai/models/ai-model.types';
import {
  PromptResponseDto,
  PromptTestResultDto,
  PromptVersionResponseDto,
} from '../src/modules/ai/prompts/dto/prompt.dto';
import { createTestApp } from './create-test-app';
import {
  authenticateContext,
  bearerAuthHeaders,
  resetAndSeedAuthTestData,
} from './helpers/users-test.helper';

/**
 * End-to-end coverage for the Prompt Management module: lifecycle
 * (DRAFT → REVIEW → APPROVED → PUBLISHED → ARCHIVED), immutable versioning,
 * rollback preserving history, the test endpoint (executed through the AI
 * Gateway), the gateway's published-prompt injection on the runtime path,
 * RBAC, and tenant isolation.
 */
describe('AI Prompts (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let usersRepository: UsersRepository;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    usersRepository = app.get(UsersRepository);
  });

  beforeEach(async () => {
    await resetAndSeedAuthTestData(prisma);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await resetAndSeedAuthTestData(prisma);
    await app.close();
  });

  // eslint-disable-next-line @typescript-eslint/require-await
  async function* fakeStream(): AsyncGenerator<AIStreamEvent> {
    yield { type: 'message_start', provider: 'openai', model: 'gpt-5-mini', messageId: 'm1' };
    yield { type: 'content_delta', provider: 'openai', model: 'gpt-5-mini', delta: 'Hello world' };
    yield {
      type: 'message_end',
      provider: 'openai',
      model: 'gpt-5-mini',
      finishReason: 'stop',
      outputText: 'Hello world',
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      credentialSource: 'PLATFORM',
    };
  }

  async function createPrompt(
    token: string,
    body: Record<string, unknown> = {},
  ): Promise<PromptResponseDto> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/ai/prompts')
      .set(bearerAuthHeaders(token))
      .send({
        key: 'sales.followup',
        name: 'Sales follow-up',
        template: 'Hello {{customer_name}}',
        variables: ['customer_name'],
        ...body,
      })
      .expect(201);
    return (response.body as ApiSuccessResponse<PromptResponseDto>).data;
  }

  function patch(token: string, id: string, body: Record<string, unknown>) {
    return request(app.getHttpServer())
      .patch(`/api/v1/ai/prompts/${id}`)
      .set(bearerAuthHeaders(token))
      .send(body);
  }

  it('creates a prompt as DRAFT with an initial version', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository, 'admin');
    const created = await createPrompt(accessToken);

    expect(created.status).toBe('DRAFT');
    expect(created.key).toBe('sales.followup');
    expect(created.publishedVersionId).toBeNull();
    expect(created.latestVersion?.version).toBe(1);
    expect(created.latestVersion?.template).toBe('Hello {{customer_name}}');
  });

  it('walks the lifecycle to PUBLISHED and resolves the published prompt at runtime', async () => {
    const { accessToken, organization, user } = await authenticateContext(
      app,
      prisma,
      usersRepository,
      'admin',
    );
    const created = await createPrompt(accessToken, {
      template: 'Hello {{customer_name}}, today is {{today}}.',
      variables: ['customer_name'],
    });

    await patch(accessToken, created.id, { status: 'REVIEW' }).expect(200);
    await patch(accessToken, created.id, { status: 'APPROVED' }).expect(200);

    const published = await request(app.getHttpServer())
      .post(`/api/v1/ai/prompts/${created.id}/publish`)
      .set(bearerAuthHeaders(accessToken))
      .send({})
      .expect(200);
    const data = (published.body as ApiSuccessResponse<PromptResponseDto>).data;
    expect(data.status).toBe('PUBLISHED');
    expect(data.publishedVersionId).toBe(created.latestVersion?.id);

    // The AI Gateway read path: resolve the published version and render it.
    const resolver = app.get(PromptResolverService);
    const rendered = await resolver.resolveSystemPrompt(
      { organizationId: organization.id, userId: user.id },
      'sales.followup',
      { customer_name: 'Ada' },
    );
    expect(rendered).not.toBeNull();
    expect(rendered).toContain('Hello Ada');
    expect(rendered).not.toContain('{{');
  });

  it('rejects publishing a prompt that has not been approved', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository, 'admin');
    const created = await createPrompt(accessToken);
    await request(app.getHttpServer())
      .post(`/api/v1/ai/prompts/${created.id}/publish`)
      .set(bearerAuthHeaders(accessToken))
      .send({})
      .expect(409);
  });

  it('appends an immutable version on update and rolls back without losing history', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository, 'admin');
    const created = await createPrompt(accessToken, {
      template: 'Version A {{customer_name}}',
      variables: ['customer_name'],
    });

    await patch(accessToken, created.id, {
      template: 'Version B {{customer_name}}',
    }).expect(200);

    const historyAfterEdit = await request(app.getHttpServer())
      .get(`/api/v1/ai/prompts/${created.id}/history`)
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    const versions = (historyAfterEdit.body as ApiSuccessResponse<PromptVersionResponseDto[]>).data;
    expect(versions).toHaveLength(2);
    expect(versions.map((v) => v.version)).toEqual([2, 1]);
    const v1 = versions.find((v) => v.version === 1)!;
    expect(v1.template).toBe('Version A {{customer_name}}');

    // Roll back to v1 — a new version copying v1, leaving history intact.
    const rolledBack = await request(app.getHttpServer())
      .post(`/api/v1/ai/prompts/${created.id}/rollback`)
      .set(bearerAuthHeaders(accessToken))
      .send({ versionId: v1.id })
      .expect(200);
    const rbData = (rolledBack.body as ApiSuccessResponse<PromptResponseDto>).data;
    expect(rbData.latestVersion?.version).toBe(3);
    expect(rbData.latestVersion?.template).toBe('Version A {{customer_name}}');

    const historyAfterRollback = await request(app.getHttpServer())
      .get(`/api/v1/ai/prompts/${created.id}/history`)
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    expect(
      (historyAfterRollback.body as ApiSuccessResponse<PromptVersionResponseDto[]>).data,
    ).toHaveLength(3);
  });

  it('renders variables and runs a test through the gateway, persisting a test run', async () => {
    const { accessToken, organization } = await authenticateContext(
      app,
      prisma,
      usersRepository,
      'admin',
    );
    const created = await createPrompt(accessToken);

    jest.spyOn(app.get(AIGatewayService), 'streamChat').mockImplementation(() => fakeStream());

    const tested = await request(app.getHttpServer())
      .post(`/api/v1/ai/prompts/${created.id}/test`)
      .set(bearerAuthHeaders(accessToken))
      .send({ variables: { customer_name: 'Ada' } })
      .expect(200);
    const result = (tested.body as ApiSuccessResponse<PromptTestResultDto>).data;

    expect(result.renderedPrompt).toBe('Hello Ada');
    expect(result.response).toBe('Hello world');
    expect(result.provider).toBe('openai');
    expect(result.model).toBe('gpt-5-mini');
    expect(result.inputTokens).toBe(10);
    expect(result.outputTokens).toBe(5);
    expect(result.totalTokens).toBe(15);
    expect(typeof result.costUsd).toBe('number');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);

    const persisted = await prisma.system.promptTestRun.count({
      where: { organizationId: organization.id, promptId: created.id },
    });
    expect(persisted).toBe(1);
  });

  it('injects a published prompt as the system prompt on the runtime path', async () => {
    const { accessToken, organization, user, membership } = await authenticateContext(
      app,
      prisma,
      usersRepository,
      'admin',
    );
    const created = await createPrompt(accessToken, {
      template: 'Hello {{customer_name}}, today is {{today}}.',
      variables: ['customer_name'],
    });
    await patch(accessToken, created.id, { status: 'REVIEW' }).expect(200);
    await patch(accessToken, created.id, { status: 'APPROVED' }).expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/ai/prompts/${created.id}/publish`)
      .set(bearerAuthHeaders(accessToken))
      .send({})
      .expect(200);

    // Knowledge retrieval is orthogonal here — stub it so the gateway does not
    // reach for embeddings, and capture what the runtime actually receives.
    jest.spyOn(app.get(KnowledgeRetrieverService), 'retrieve').mockResolvedValue([]);
    let captured: AIRuntimeChatInput | undefined;
    jest.spyOn(app.get(AIRuntimeService), 'streamChat').mockImplementation((arg) => {
      captured = arg;
      return fakeStream();
    });

    const gateway = app.get(AIGatewayService);
    const tenantContext = app.get(TenantContextService);
    await tenantContext.run(
      {
        organizationId: organization.id,
        userId: user.id,
        membershipId: membership.id,
        requestId: 'test-req',
      },
      async () => {
        for await (const _event of gateway.streamChat({
          requestType: 'CHAT',
          promptKey: 'sales.followup',
          promptVariables: { customer_name: 'Ada' },
          userPrompt: 'hello',
        })) {
          void _event;
        }
      },
    );

    expect(captured?.systemPrompt).toContain('Hello Ada');
    expect(captured?.systemPrompt).not.toContain('{{');
  });

  it('enforces RBAC — a viewer cannot create a prompt', async () => {
    const viewer = await authenticateContext(app, prisma, usersRepository, 'viewer', {
      email: 'viewer-prompts@example.com',
    });
    await request(app.getHttpServer())
      .post('/api/v1/ai/prompts')
      .set(bearerAuthHeaders(viewer.accessToken))
      .send({ key: 'x.y', name: 'X', template: 'hi' })
      .expect(403);
  });

  it('isolates tenants — one org cannot read or delete another org’s prompt', async () => {
    const orgA = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: 'prompts-org-a@example.com',
    });
    const orgB = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: 'prompts-org-b@example.com',
    });
    const created = await createPrompt(orgA.accessToken);

    await request(app.getHttpServer())
      .get(`/api/v1/ai/prompts/${created.id}`)
      .set(bearerAuthHeaders(orgB.accessToken))
      .expect(404);
    await request(app.getHttpServer())
      .delete(`/api/v1/ai/prompts/${created.id}`)
      .set(bearerAuthHeaders(orgB.accessToken))
      .expect(404);

    // orgB can create its own prompt with the same key — keys are per-org.
    await createPrompt(orgB.accessToken);
  });

  it('rejects a duplicate key within an organization', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository, 'admin');
    await createPrompt(accessToken);
    await request(app.getHttpServer())
      .post('/api/v1/ai/prompts')
      .set(bearerAuthHeaders(accessToken))
      .send({ key: 'sales.followup', name: 'Dup', template: 'hi' })
      .expect(409);
  });

  it('rejects an invalid template (undeclared variable)', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository, 'admin');
    await request(app.getHttpServer())
      .post('/api/v1/ai/prompts')
      .set(bearerAuthHeaders(accessToken))
      .send({ key: 'bad.template', name: 'Bad', template: 'Hi {{undeclared}}' })
      .expect(400);
  });
});
