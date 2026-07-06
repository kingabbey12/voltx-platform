import { createHmac } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiSuccessResponse } from '../src/common/interceptors/response.interceptor';
import { AIEmbeddingRequest, AIEmbeddingResponse } from '../src/modules/ai/models/ai-model.types';
import { ModelRegistryService } from '../src/modules/ai/models/model-registry.service';
import { AIRuntimeService } from '../src/modules/ai/runtime/ai-runtime.service';
import { EncryptionService } from '../src/modules/integrations/security/encryption.service';
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jsonFetchResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json', ...headers }),
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}

describe('Integration Platform (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let usersRepository: UsersRepository;
  let encryptionService: EncryptionService;
  let aiRuntimeService: AIRuntimeService;
  let modelRegistryService: ModelRegistryService;
  const originalFetch = global.fetch;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    usersRepository = app.get(UsersRepository);
    encryptionService = app.get(EncryptionService);
    aiRuntimeService = app.get(AIRuntimeService);
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

  afterEach(() => {
    global.fetch = originalFetch;
  });

  afterAll(async () => {
    await resetAndSeedAuthTestData(prisma);
    await app.close();
  });

  interface ConnectionResponse {
    id: string;
    provider: string;
    status: string;
    displayName: string;
    version: number;
  }

  async function createStripeConnection(
    accessToken: string,
    overrides: Record<string, unknown> = {},
  ): Promise<ConnectionResponse> {
    const response = await request(app.getHttpServer())
      .post('/api/v1/integrations/connections')
      .set(bearerAuthHeaders(accessToken))
      .send({
        provider: 'STRIPE',
        displayName: `Stripe ${Date.now()}-${Math.random()}`,
        apiKey: 'sk_test_123',
        ...overrides,
      })
      .expect(201);
    return (response.body as ApiSuccessResponse<ConnectionResponse>).data;
  }

  async function seedWebhookConnection(params: {
    provider: string;
    secret: string;
    organizationId: string;
    userId: string;
  }): Promise<{ connectionId: string; token: string }> {
    const systemClient = prisma.system as unknown as {
      integrationConnection: {
        create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
      };
      integrationWebhookEndpoint: {
        create(args: { data: Record<string, unknown> }): Promise<{ token: string }>;
      };
    };

    const connection = await systemClient.integrationConnection.create({
      data: {
        organizationId: params.organizationId,
        provider: params.provider,
        displayName: `${params.provider} webhook test`,
        authType:
          params.provider === 'STRIPE'
            ? 'API_KEY'
            : params.provider === 'WEBHOOK'
              ? 'WEBHOOK_SECRET'
              : 'OAUTH2',
        status: 'CONNECTED',
        createdBy: params.userId,
      },
    });

    const endpoint = await systemClient.integrationWebhookEndpoint.create({
      data: {
        connectionId: connection.id,
        organizationId: params.organizationId,
        provider: params.provider,
        token: `test-token-${connection.id}`,
        encryptedSecret: encryptionService.encrypt(params.secret),
      },
    });

    return { connectionId: connection.id, token: endpoint.token };
  }

  describe('Admin API — API-key connections', () => {
    it('creates, reads, lists, updates, and deletes a connection', async () => {
      const { accessToken } = await authenticateContext(app, prisma, usersRepository);
      const connection = await createStripeConnection(accessToken);
      expect(connection.status).toBe('CONNECTED');

      const getResponse = await request(app.getHttpServer())
        .get(`/api/v1/integrations/connections/${connection.id}`)
        .set(bearerAuthHeaders(accessToken))
        .expect(200);
      expect((getResponse.body as ApiSuccessResponse<ConnectionResponse>).data.id).toBe(
        connection.id,
      );

      const listResponse = await request(app.getHttpServer())
        .get('/api/v1/integrations/connections')
        .set(bearerAuthHeaders(accessToken))
        .expect(200);
      const listBody = (listResponse.body as ApiSuccessResponse<{ items: ConnectionResponse[] }>)
        .data;
      expect(listBody.items.some((item) => item.id === connection.id)).toBe(true);

      const updateResponse = await request(app.getHttpServer())
        .patch(`/api/v1/integrations/connections/${connection.id}`)
        .set(bearerAuthHeaders(accessToken))
        .send({ displayName: 'Renamed Stripe Connection' })
        .expect(200);
      expect((updateResponse.body as ApiSuccessResponse<ConnectionResponse>).data.displayName).toBe(
        'Renamed Stripe Connection',
      );

      await request(app.getHttpServer())
        .delete(`/api/v1/integrations/connections/${connection.id}`)
        .set(bearerAuthHeaders(accessToken))
        .expect(200);

      await request(app.getHttpServer())
        .get(`/api/v1/integrations/connections/${connection.id}`)
        .set(bearerAuthHeaders(accessToken))
        .expect(404);
    });

    it('runs a health check against the provider', async () => {
      const { accessToken } = await authenticateContext(app, prisma, usersRepository);
      const connection = await createStripeConnection(accessToken);

      global.fetch = jest
        .fn()
        .mockResolvedValue(jsonFetchResponse(200, { available: [] })) as never;

      const response = await request(app.getHttpServer())
        .post(`/api/v1/integrations/connections/${connection.id}/health-check`)
        .set(bearerAuthHeaders(accessToken))
        .expect(201);

      expect((response.body as ApiSuccessResponse<{ healthy: boolean }>).data.healthy).toBe(true);
    });
  });

  describe('OAuth flow', () => {
    it('initiates and completes an OAuth2 connection, storing an encrypted credential', async () => {
      const { accessToken } = await authenticateContext(app, prisma, usersRepository);

      const initiateResponse = await request(app.getHttpServer())
        .post('/api/v1/integrations/connections/oauth/initiate')
        .set(bearerAuthHeaders(accessToken))
        .send({
          provider: 'GOOGLE_GMAIL',
          displayName: 'My Gmail',
          redirectUri: 'https://app.voltx.io/callback',
        })
        .expect(201);

      const initiateBody = (
        initiateResponse.body as ApiSuccessResponse<{
          connectionId: string;
          authorizationUrl: string;
        }>
      ).data;
      expect(initiateBody.authorizationUrl).toContain('accounts.google.com');
      expect(initiateBody.connectionId).toBeTruthy();

      global.fetch = jest.fn().mockResolvedValue(
        jsonFetchResponse(200, {
          access_token: 'gmail-access-token',
          refresh_token: 'gmail-refresh-token',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      ) as never;

      const completeResponse = await request(app.getHttpServer())
        .post('/api/v1/integrations/connections/oauth/complete')
        .set(bearerAuthHeaders(accessToken))
        .send({
          connectionId: initiateBody.connectionId,
          code: 'auth-code-123',
          redirectUri: 'https://app.voltx.io/callback',
        })
        .expect(201);

      const connection = (completeResponse.body as ApiSuccessResponse<ConnectionResponse>).data;
      expect(connection.status).toBe('CONNECTED');

      const systemClient = prisma.system as unknown as {
        integrationCredential: {
          findFirst(args: {
            where: { connectionId: string };
          }): Promise<{ encryptedPayload: string } | null>;
        };
      };
      const credentialRow = await systemClient.integrationCredential.findFirst({
        where: { connectionId: connection.id },
      });
      expect(credentialRow).not.toBeNull();
      expect(credentialRow!.encryptedPayload).not.toContain('gmail-access-token');
      const decrypted = encryptionService.decryptJson<{ accessToken: string }>(
        credentialRow!.encryptedPayload,
      );
      expect(decrypted.accessToken).toBe('gmail-access-token');
    });
  });

  describe('Token refresh', () => {
    it('force-refreshes an OAuth token via the admin endpoint', async () => {
      const { accessToken, organization, user } = await authenticateContext(
        app,
        prisma,
        usersRepository,
      );
      const systemClient = prisma.system as unknown as {
        integrationConnection: {
          create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
        };
      };
      const connection = await systemClient.integrationConnection.create({
        data: {
          organizationId: organization.id,
          provider: 'GOOGLE_GMAIL',
          displayName: 'Refreshable Gmail',
          authType: 'OAUTH2',
          status: 'CONNECTED',
          createdBy: user.id,
        },
      });

      const credentialSystemClient = prisma.system as unknown as {
        integrationCredential: {
          create(args: { data: Record<string, unknown> }): Promise<unknown>;
        };
      };
      await credentialSystemClient.integrationCredential.create({
        data: {
          connectionId: connection.id,
          organizationId: organization.id,
          encryptedPayload: encryptionService.encryptJson({
            accessToken: 'stale-access',
            refreshToken: 'valid-refresh',
          }),
          expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });

      global.fetch = jest.fn().mockResolvedValue(
        jsonFetchResponse(200, {
          access_token: 'refreshed-access',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      ) as never;

      const response = await request(app.getHttpServer())
        .post(`/api/v1/integrations/connections/${connection.id}/refresh-token`)
        .set(bearerAuthHeaders(accessToken))
        .expect(201);

      expect((response.body as ApiSuccessResponse<ConnectionResponse>).data.id).toBe(connection.id);

      const credentialSystemClientRead = prisma.system as unknown as {
        integrationCredential: {
          findFirst(args: {
            where: { connectionId: string };
          }): Promise<{ encryptedPayload: string } | null>;
        };
      };
      const record = await credentialSystemClientRead.integrationCredential.findFirst({
        where: { connectionId: connection.id },
      });
      const decrypted = encryptionService.decryptJson<{ accessToken: string }>(
        record!.encryptedPayload,
      );
      expect(decrypted.accessToken).toBe('refreshed-access');
    });
  });

  describe('Webhook verification and idempotency', () => {
    it('accepts a correctly signed generic webhook and records the event', async () => {
      const { organization, user } = await authenticateContext(app, prisma, usersRepository);
      const secret = 'generic-webhook-secret';
      const { token } = await seedWebhookConnection({
        provider: 'WEBHOOK',
        secret,
        organizationId: organization.id,
        userId: user.id,
      });

      const payload = JSON.stringify({ id: 'evt-abc', kind: 'ping' });
      const signature = createHmac('sha256', secret).update(payload).digest('hex');

      const response = await request(app.getHttpServer())
        .post(`/api/v1/integrations/webhooks/${token}`)
        .set('Content-Type', 'application/json')
        .set('X-Voltx-Signature', signature)
        .send(payload)
        .expect(200);

      expect(
        (response.body as { eventsProcessed: number }).eventsProcessed ?? response.body,
      ).toBeTruthy();

      const systemClient = prisma.system as unknown as {
        integrationEvent: {
          findMany(args: { where: Record<string, unknown> }): Promise<unknown[]>;
        };
      };
      const events = await systemClient.integrationEvent.findMany({
        where: { externalId: 'evt-abc' },
      });
      expect(events).toHaveLength(1);
    });

    it('rejects a webhook with an invalid signature', async () => {
      const { organization, user } = await authenticateContext(app, prisma, usersRepository);
      const { token } = await seedWebhookConnection({
        provider: 'WEBHOOK',
        secret: 'correct-secret',
        organizationId: organization.id,
        userId: user.id,
      });

      await request(app.getHttpServer())
        .post(`/api/v1/integrations/webhooks/${token}`)
        .set('Content-Type', 'application/json')
        .set('X-Voltx-Signature', 'deadbeef')
        .send(JSON.stringify({ id: 'evt-1' }))
        .expect(401);
    });

    it('returns 404 for an unknown webhook token', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/integrations/webhooks/does-not-exist')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({}))
        .expect(404);
    });

    it('is idempotent — the same externalId delivered twice only produces one event', async () => {
      const { organization, user } = await authenticateContext(app, prisma, usersRepository);
      const secret = 'idempotent-secret';
      const { token } = await seedWebhookConnection({
        provider: 'WEBHOOK',
        secret,
        organizationId: organization.id,
        userId: user.id,
      });

      const payload = JSON.stringify({ id: 'evt-duplicate', kind: 'ping' });
      const signature = createHmac('sha256', secret).update(payload).digest('hex');

      for (let attempt = 0; attempt < 2; attempt += 1) {
        await request(app.getHttpServer())
          .post(`/api/v1/integrations/webhooks/${token}`)
          .set('Content-Type', 'application/json')
          .set('X-Voltx-Signature', signature)
          .send(payload)
          .expect(200);
      }

      const systemClient = prisma.system as unknown as {
        integrationEvent: {
          findMany(args: { where: Record<string, unknown> }): Promise<unknown[]>;
        };
      };
      const events = await systemClient.integrationEvent.findMany({
        where: { externalId: 'evt-duplicate' },
      });
      expect(events).toHaveLength(1);
    });
  });

  describe('API failures and retries', () => {
    it('marks the connection ERROR and logs the failure when the provider call fails', async () => {
      const { accessToken } = await authenticateContext(app, prisma, usersRepository);
      const connection = await createStripeConnection(accessToken);

      global.fetch = jest
        .fn()
        .mockResolvedValue(jsonFetchResponse(500, { error: 'stripe is down' })) as never;

      await request(app.getHttpServer())
        .post(`/api/v1/integrations/connections/${connection.id}/health-check`)
        .set(bearerAuthHeaders(accessToken))
        .expect(201);

      const getResponse = await request(app.getHttpServer())
        .get(`/api/v1/integrations/connections/${connection.id}`)
        .set(bearerAuthHeaders(accessToken))
        .expect(200);
      expect((getResponse.body as ApiSuccessResponse<ConnectionResponse>).data.status).toBe(
        'ERROR',
      );

      const logsResponse = await request(app.getHttpServer())
        .get(`/api/v1/integrations/connections/${connection.id}/logs`)
        .set(bearerAuthHeaders(accessToken))
        .expect(200);
      const logs = (logsResponse.body as ApiSuccessResponse<{ items: Array<{ action: string }> }>)
        .data.items;
      expect(logs.length).toBeGreaterThan(0);
    });
  });

  describe('Workflow integration', () => {
    it('runs an INTEGRATION workflow step through the generic REST connector', async () => {
      const { accessToken } = await authenticateContext(app, prisma, usersRepository);
      const restConnectionResponse = await request(app.getHttpServer())
        .post('/api/v1/integrations/connections')
        .set(bearerAuthHeaders(accessToken))
        .send({ provider: 'REST_API', displayName: 'Test REST API' })
        .expect(201);
      const restConnection = (restConnectionResponse.body as ApiSuccessResponse<ConnectionResponse>)
        .data;

      global.fetch = jest
        .fn()
        .mockResolvedValue(jsonFetchResponse(200, { received: true })) as never;

      const workflowResponse = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set(bearerAuthHeaders(accessToken))
        .send({
          name: `Integration Workflow ${Date.now()}`,
          definition: {
            steps: [
              {
                id: 'call-rest',
                name: 'Call REST API',
                type: 'INTEGRATION',
                config: {
                  provider: 'REST_API',
                  actionName: 'call',
                  connectionId: restConnection.id,
                  input: {
                    url: 'https://api.example.com/notify',
                    method: 'POST',
                    body: { hello: 'world' },
                  },
                },
              },
            ],
          },
        })
        .expect(201);
      const workflow = (workflowResponse.body as ApiSuccessResponse<{ id: string }>).data;

      await request(app.getHttpServer())
        .post(`/api/v1/workflows/${workflow.id}/publish`)
        .set(bearerAuthHeaders(accessToken))
        .expect(201);

      const runResponse = await request(app.getHttpServer())
        .post(`/api/v1/workflows/${workflow.id}/run`)
        .set(bearerAuthHeaders(accessToken))
        .send({})
        .expect(201);

      const run = (
        runResponse.body as ApiSuccessResponse<{ status: string; context: Record<string, unknown> }>
      ).data;
      expect(run.status).toBe('SUCCEEDED');
      expect((run.context['call-rest'] as { body: { received: boolean } }).body.received).toBe(
        true,
      );
    });
  });

  describe('Knowledge ingestion', () => {
    it('contributes a Slack message webhook delivery to the Knowledge Graph', async () => {
      const { organization, user } = await authenticateContext(app, prisma, usersRepository);

      jest
        .spyOn(aiRuntimeService, 'embeddings')
        .mockImplementation((input: Pick<AIEmbeddingRequest, 'input'>) =>
          Promise.resolve({
            provider: 'openai',
            model: 'text-embedding-3-small',
            vectors: input.input.map(() =>
              new Array(1536).fill(0).map((_, i) => (i === 0 ? 1 : 0)),
            ),
          } as AIEmbeddingResponse),
        );

      const secret = 'slack-signing-secret';
      const { token } = await seedWebhookConnection({
        provider: 'SLACK',
        secret,
        organizationId: organization.id,
        userId: user.id,
      });

      const body = JSON.stringify({
        event: {
          type: 'message',
          channel: 'C123',
          user: 'U456',
          text: 'Deal closed for Acme Corp',
          ts: '999.111',
        },
      });
      const timestamp = String(Math.floor(Date.now() / 1000));
      const signature = `v0=${createHmac('sha256', secret).update(`v0:${timestamp}:${body}`).digest('hex')}`;

      await request(app.getHttpServer())
        .post(`/api/v1/integrations/webhooks/${token}`)
        .set('Content-Type', 'application/json')
        .set('X-Slack-Request-Timestamp', timestamp)
        .set('X-Slack-Signature', signature)
        .send(body)
        .expect(200);

      const systemClient = prisma.system as unknown as {
        knowledgeSource: {
          findMany(args: {
            where: Record<string, unknown>;
          }): Promise<Array<{ id: string; type: string }>>;
        };
        knowledgeDocument: {
          findMany(args: { where: Record<string, unknown> }): Promise<unknown[]>;
        };
      };
      const sources = await systemClient.knowledgeSource.findMany({
        where: { organizationId: organization.id, type: 'MESSAGE' },
      });
      expect(sources).toHaveLength(1);

      const documents = await systemClient.knowledgeDocument.findMany({
        where: { sourceId: sources[0].id },
      });
      expect(documents).toHaveLength(1);
    });
  });

  describe('AI Tool usage', () => {
    async function createConversation(accessToken: string): Promise<{ id: string }> {
      const response = await request(app.getHttpServer())
        .post('/api/v1/ai/conversations')
        .set(bearerAuthHeaders(accessToken))
        .send({ title: 'Integration Tool Conversation' })
        .expect(201);
      return (response.body as ApiSuccessResponse<{ id: string }>).data;
    }

    it('executes a dynamically-registered integration AI tool', async () => {
      const { accessToken } = await authenticateContext(app, prisma, usersRepository);
      const connection = await createStripeConnection(accessToken);
      const conversation = await createConversation(accessToken);

      global.fetch = jest
        .fn()
        .mockResolvedValue(jsonFetchResponse(200, { id: 'cus_new123' })) as never;

      const toolsResponse = await request(app.getHttpServer())
        .get('/api/v1/ai/tools')
        .set(bearerAuthHeaders(accessToken))
        .expect(200);
      const toolNames = (
        toolsResponse.body as ApiSuccessResponse<Array<{ name: string }>>
      ).data.map((tool) => tool.name);
      expect(toolNames).toContain('integration_stripe_create_customer');

      const executeResponse = await request(app.getHttpServer())
        .post('/api/v1/ai/tools/execute')
        .set(bearerAuthHeaders(accessToken))
        .send({
          conversationId: conversation.id,
          toolName: 'integration_stripe_create_customer',
          input: { email: 'customer@example.com', connectionId: connection.id },
        })
        .expect(201);

      const executeBody = executeResponse.body as ApiSuccessResponse<{
        execution: { status: string };
        result: { content: string; isError?: boolean };
      }>;
      expect(executeBody.data.execution.status).toBe('SUCCEEDED');
      expect(executeBody.data.result.content).toContain('cus_new123');
    });
  });

  describe('Multiple connected accounts', () => {
    it('requires an explicit connectionId when more than one connection exists for a provider', async () => {
      const { accessToken } = await authenticateContext(app, prisma, usersRepository);
      const first = await createStripeConnection(accessToken, { externalAccountId: 'acct_one' });
      const second = await createStripeConnection(accessToken, { externalAccountId: 'acct_two' });
      const conversation = await request(app.getHttpServer())
        .post('/api/v1/ai/conversations')
        .set(bearerAuthHeaders(accessToken))
        .send({ title: 'Ambiguous Connection Conversation' })
        .expect(201);
      const conversationId = (conversation.body as ApiSuccessResponse<{ id: string }>).data.id;

      const ambiguousResponse = await request(app.getHttpServer())
        .post('/api/v1/ai/tools/execute')
        .set(bearerAuthHeaders(accessToken))
        .send({
          conversationId,
          toolName: 'integration_stripe_create_customer',
          input: { email: 'x@y.com' },
        })
        .expect(201);
      const ambiguousBody = ambiguousResponse.body as ApiSuccessResponse<{
        result: { isError?: boolean; content: string };
      }>;
      expect(ambiguousBody.data.result.isError).toBe(true);

      global.fetch = jest
        .fn()
        .mockResolvedValue(jsonFetchResponse(200, { id: 'cus_specific' })) as never;

      const explicitResponse = await request(app.getHttpServer())
        .post('/api/v1/ai/tools/execute')
        .set(bearerAuthHeaders(accessToken))
        .send({
          conversationId,
          toolName: 'integration_stripe_create_customer',
          input: { email: 'x@y.com', connectionId: second.id },
        })
        .expect(201);
      const explicitBody = explicitResponse.body as ApiSuccessResponse<{
        result: { content: string; isError?: boolean };
      }>;
      expect(explicitBody.data.result.isError ?? false).toBe(false);
      expect(explicitBody.data.result.content).toContain('cus_specific');

      void first;
    });
  });

  describe('Streaming', () => {
    it('streams a webhook-triggered event to a connected SSE client in real time', async () => {
      const { accessToken, organization, user } = await authenticateContext(
        app,
        prisma,
        usersRepository,
      );
      const secret = 'stream-secret';
      const { token } = await seedWebhookConnection({
        provider: 'WEBHOOK',
        secret,
        organizationId: organization.id,
        userId: user.id,
      });

      const streamPromise = (async () =>
        await request(app.getHttpServer())
          .get('/api/v1/integrations/events/stream')
          .set(bearerAuthHeaders(accessToken))
          .buffer(true)
          .parse((response, callback) => {
            const stream = response as unknown as NodeJS.ReadableStream & { destroy(): void };
            let data = '';
            stream.on('data', (chunk: Buffer) => {
              data += chunk.toString('utf8');
              if (data.includes('"type":"WEBHOOK_RECEIVED"')) {
                stream.destroy();
              }
            });
            stream.on('close', () => callback(null, data));
            stream.on('end', () => callback(null, data));
          }))();

      await delay(200);

      const payload = JSON.stringify({ id: 'evt-stream', kind: 'ping' });
      const signature = createHmac('sha256', secret).update(payload).digest('hex');
      await request(app.getHttpServer())
        .post(`/api/v1/integrations/webhooks/${token}`)
        .set('Content-Type', 'application/json')
        .set('X-Voltx-Signature', signature)
        .send(payload)
        .expect(200);

      const response = await streamPromise;
      const raw = (response.body as unknown as string) || response.text;
      const frames = parseSseFrames(raw);
      expect(frames.some((frame) => frame.event === 'WEBHOOK_RECEIVED')).toBe(true);
    }, 10000);
  });

  describe('Organization isolation', () => {
    it('never returns another organization’s connections', async () => {
      const orgA = await authenticateContext(app, prisma, usersRepository, 'admin', {
        email: 'integration-org-a@example.com',
      });
      const orgB = await authenticateContext(app, prisma, usersRepository, 'admin', {
        email: 'integration-org-b@example.com',
      });

      const connection = await createStripeConnection(orgA.accessToken);

      await request(app.getHttpServer())
        .get(`/api/v1/integrations/connections/${connection.id}`)
        .set(bearerAuthHeaders(orgB.accessToken))
        .expect(404);

      const listResponse = await request(app.getHttpServer())
        .get('/api/v1/integrations/connections')
        .set(bearerAuthHeaders(orgB.accessToken))
        .expect(200);
      const items = (listResponse.body as ApiSuccessResponse<{ items: ConnectionResponse[] }>).data
        .items;
      expect(items.every((item) => item.id !== connection.id)).toBe(true);
    });
  });
});
