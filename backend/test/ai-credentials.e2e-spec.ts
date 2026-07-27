import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiSuccessResponse } from '../src/common/interceptors/response.interceptor';
import { PrismaService } from '../src/database/prisma.service';
import { UsersRepository } from '../src/modules/users/users.repository';
import {
  AiCredentialResponseDto,
  AiCredentialTestResultDto,
  PaginatedAiCredentialsDto,
} from '../src/modules/ai/credentials/dto/ai-credential.dto';
import { createTestApp } from './create-test-app';
import {
  authenticateContext,
  bearerAuthHeaders,
  resetAndSeedAuthTestData,
} from './helpers/users-test.helper';

/**
 * End-to-end coverage for the Tenant AI Credentials module: encryption at
 * rest, masking on read, rotation, RBAC, tenant isolation, and the live
 * provider health check (the provider HTTP call is mocked via global.fetch).
 */
describe('Tenant AI Credentials (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let usersRepository: UsersRepository;
  const originalFetch = global.fetch;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    usersRepository = app.get(UsersRepository);
  });

  beforeEach(async () => {
    await resetAndSeedAuthTestData(prisma);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await resetAndSeedAuthTestData(prisma);
    await app.close();
  });

  function okChatFetch(): typeof fetch {
    return jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'cmpl-1',
          model: 'gpt-5-mini',
          choices: [{ message: { content: 'pong' }, finish_reason: 'stop' }],
          usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );
  }

  async function createCredential(
    token: string,
    body: Record<string, unknown> = {},
  ): Promise<AiCredentialResponseDto> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/ai/credentials')
      .set(bearerAuthHeaders(token))
      .send({ provider: 'openai', apiKey: 'sk-super-secret-key-1234', ...body })
      .expect(201);
    return (response.body as ApiSuccessResponse<AiCredentialResponseDto>).data;
  }

  it('encrypts on create and only ever returns a masked key', async () => {
    const { accessToken, organization } = await authenticateContext(
      app,
      prisma,
      usersRepository,
      'admin',
    );

    const created = await createCredential(accessToken);
    expect(created.provider).toBe('openai');
    expect(created.status).toBe('ACTIVE');
    expect(created.maskedApiKey).toBe('sk-…1234');
    expect(JSON.stringify(created)).not.toContain('sk-super-secret-key-1234');

    // At rest, the stored value is ciphertext, never the plaintext key.
    const row = await (
      prisma.system as unknown as {
        aiProviderCredential: {
          findFirst(args: { where: { organizationId: string } }): Promise<{
            encryptedApiKey: string;
          } | null>;
        };
      }
    ).aiProviderCredential.findFirst({ where: { organizationId: organization.id } });
    expect(row?.encryptedApiKey).toBeDefined();
    expect(row?.encryptedApiKey).not.toContain('sk-super-secret-key-1234');
  });

  it('lists and reads credentials with the key masked', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository, 'admin');
    const created = await createCredential(accessToken);

    const list = await request(app.getHttpServer())
      .get('/api/v1/ai/credentials')
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    const listBody = (list.body as ApiSuccessResponse<PaginatedAiCredentialsDto>).data;
    expect(listBody.total).toBe(1);
    expect(listBody.items[0].maskedApiKey).toBe('sk-…1234');

    const read = await request(app.getHttpServer())
      .get(`/api/v1/ai/credentials/${created.id}`)
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    expect(JSON.stringify(read.body)).not.toContain('sk-super-secret-key-1234');
  });

  it('rejects a duplicate provider+label', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository, 'admin');
    await createCredential(accessToken);
    await request(app.getHttpServer())
      .post('/api/v1/ai/credentials')
      .set(bearerAuthHeaders(accessToken))
      .send({ provider: 'openai', apiKey: 'sk-another' })
      .expect(409);
  });

  it('updates metadata/status without touching the key', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository, 'admin');
    const created = await createCredential(accessToken);

    const updated = await request(app.getHttpServer())
      .patch(`/api/v1/ai/credentials/${created.id}`)
      .set(bearerAuthHeaders(accessToken))
      .send({ status: 'DISABLED', label: 'archived' })
      .expect(200);
    const data = (updated.body as ApiSuccessResponse<AiCredentialResponseDto>).data;
    expect(data.status).toBe('DISABLED');
    expect(data.label).toBe('archived');
    expect(data.maskedApiKey).toBe('sk-…1234');
  });

  it('rotates the key, re-encrypting in place and resetting the last test result', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository, 'admin');
    const created = await createCredential(accessToken);

    const rotated = await request(app.getHttpServer())
      .post(`/api/v1/ai/credentials/${created.id}/rotate`)
      .set(bearerAuthHeaders(accessToken))
      .send({ apiKey: 'sk-rotated-key-9999' })
      .expect(200);
    const data = (rotated.body as ApiSuccessResponse<AiCredentialResponseDto>).data;
    expect(data.lastRotatedAt).not.toBeNull();
    expect(data.maskedApiKey).toBe('sk-…9999');
    expect(data.lastTestStatus).toBeNull();
    expect(JSON.stringify(rotated.body)).not.toContain('sk-rotated-key-9999');
  });

  it('health-checks a credential with a live provider call (mocked)', async () => {
    global.fetch = okChatFetch();
    const { accessToken } = await authenticateContext(app, prisma, usersRepository, 'admin');
    const created = await createCredential(accessToken);

    const tested = await request(app.getHttpServer())
      .post(`/api/v1/ai/credentials/${created.id}/test`)
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    const result = (tested.body as ApiSuccessResponse<AiCredentialTestResultDto>).data;
    expect(result.status).toBe('ok');

    // The result is persisted onto the credential.
    const read = await request(app.getHttpServer())
      .get(`/api/v1/ai/credentials/${created.id}`)
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    expect((read.body as ApiSuccessResponse<AiCredentialResponseDto>).data.lastTestStatus).toBe(
      'ok',
    );
  });

  it('soft-deletes a credential', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository, 'admin');
    const created = await createCredential(accessToken);

    await request(app.getHttpServer())
      .delete(`/api/v1/ai/credentials/${created.id}`)
      .set(bearerAuthHeaders(accessToken))
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/v1/ai/credentials/${created.id}`)
      .set(bearerAuthHeaders(accessToken))
      .expect(404);
  });

  it('enforces RBAC — a viewer cannot store a credential', async () => {
    const viewer = await authenticateContext(app, prisma, usersRepository, 'viewer', {
      email: 'viewer-creds@example.com',
    });
    await request(app.getHttpServer())
      .post('/api/v1/ai/credentials')
      .set(bearerAuthHeaders(viewer.accessToken))
      .send({ provider: 'openai', apiKey: 'sk-nope' })
      .expect(403);
  });

  it('isolates tenants — one org cannot read or delete another org’s credential', async () => {
    const orgA = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: 'creds-org-a@example.com',
    });
    const orgB = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: 'creds-org-b@example.com',
    });
    const created = await createCredential(orgA.accessToken);

    await request(app.getHttpServer())
      .get(`/api/v1/ai/credentials/${created.id}`)
      .set(bearerAuthHeaders(orgB.accessToken))
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/api/v1/ai/credentials/${created.id}`)
      .set(bearerAuthHeaders(orgB.accessToken))
      .expect(404);

    // org A still sees exactly its own one credential.
    const list = await request(app.getHttpServer())
      .get('/api/v1/ai/credentials')
      .set(bearerAuthHeaders(orgA.accessToken))
      .expect(200);
    expect((list.body as ApiSuccessResponse<PaginatedAiCredentialsDto>).data.total).toBe(1);
  });
});
