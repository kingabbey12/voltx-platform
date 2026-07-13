import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiSuccessResponse } from '../src/common/interceptors/response.interceptor';
import { PrismaService } from '../src/database/prisma.service';
import { UsersRepository } from '../src/modules/users/users.repository';
import { createTestApp } from './create-test-app';
import { authenticateContext, resetAndSeedAuthTestData } from './helpers/users-test.helper';

interface CreateWebhookEndpointResponse {
  id: string;
  url: string;
  eventTypes: string[];
  status: string;
  secret: string;
}

interface WebhookDeliveryResponse {
  id: string;
  eventType: string;
  status: string;
  attemptCount: number;
  responseStatusCode: number | null;
}

/**
 * example.com is used as the delivery target because it's a real,
 * publicly resolvable domain (unlike acme.example, which doesn't resolve
 * — see the OAuth provider e2e suite's own note) — OutboundHttpGuardService
 * blocks loopback/private-IP destinations, so a genuinely reachable public
 * host is required to exercise the real delivery path end to end. It has
 * no webhook receiver, so every attempt gets a real non-2xx response
 * (typically 404), which is exactly what these tests assert on.
 */
const ENDPOINT_URL = 'https://example.com/webhooks/voltx';

describe('Webhook Endpoints & Delivery (e2e)', () => {
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

  afterAll(async () => {
    await resetAndSeedAuthTestData(prisma);
    await app.close();
  });

  async function registerEndpoint(
    accessToken: string,
    organizationId: string,
    eventTypes: string[] = ['sales.lead.created'],
  ): Promise<CreateWebhookEndpointResponse> {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationId}/webhook-endpoints`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ url: ENDPOINT_URL, eventTypes })
      .expect(201);
    return (response.body as ApiSuccessResponse<CreateWebhookEndpointResponse>).data;
  }

  it('runs the full endpoint lifecycle: register, list, update, rotate secret, suspend, reactivate, delete', async () => {
    const owner = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `webhook-lifecycle-${Date.now()}@example.com`,
    });
    const auth = { Authorization: `Bearer ${owner.accessToken}` };

    const endpoint = await registerEndpoint(owner.accessToken, owner.organization.id);
    expect(endpoint.secret).toMatch(/^whsec_/);
    expect(endpoint.eventTypes).toEqual(['sales.lead.created']);

    const listResponse = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${owner.organization.id}/webhook-endpoints`)
      .set(auth)
      .expect(200);
    expect((listResponse.body as ApiSuccessResponse<unknown[]>).data).toHaveLength(1);

    const updateResponse = await request(app.getHttpServer())
      .patch(`/api/v1/organizations/${owner.organization.id}/webhook-endpoints/${endpoint.id}`)
      .set(auth)
      .send({ eventTypes: ['sales.lead.created', 'workflow.run.completed'] })
      .expect(200);
    expect(
      (updateResponse.body as ApiSuccessResponse<{ eventTypes: string[] }>).data.eventTypes,
    ).toEqual(['sales.lead.created', 'workflow.run.completed']);

    const rotateResponse = await request(app.getHttpServer())
      .post(
        `/api/v1/organizations/${owner.organization.id}/webhook-endpoints/${endpoint.id}/rotate-secret`,
      )
      .set(auth)
      .expect(200);
    const newSecret = (rotateResponse.body as ApiSuccessResponse<{ secret: string }>).data.secret;
    expect(newSecret).toMatch(/^whsec_/);
    expect(newSecret).not.toBe(endpoint.secret);

    await request(app.getHttpServer())
      .post(
        `/api/v1/organizations/${owner.organization.id}/webhook-endpoints/${endpoint.id}/suspend`,
      )
      .set(auth)
      .expect(200);

    await request(app.getHttpServer())
      .post(
        `/api/v1/organizations/${owner.organization.id}/webhook-endpoints/${endpoint.id}/reactivate`,
      )
      .set(auth)
      .expect(200);

    await request(app.getHttpServer())
      .delete(`/api/v1/organizations/${owner.organization.id}/webhook-endpoints/${endpoint.id}`)
      .set(auth)
      .expect(200);

    const finalList = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${owner.organization.id}/webhook-endpoints`)
      .set(auth)
      .expect(200);
    expect((finalList.body as ApiSuccessResponse<unknown[]>).data).toEqual([]);
  });

  it('publishes a real domain event to a subscribed endpoint, records the delivery attempt, and supports replay', async () => {
    const owner = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `webhook-delivery-${Date.now()}@example.com`,
    });
    const auth = { Authorization: `Bearer ${owner.accessToken}` };

    const endpoint = await registerEndpoint(owner.accessToken, owner.organization.id, [
      'sales.lead.created',
    ]);

    await request(app.getHttpServer())
      .post('/api/v1/sales/leads')
      .set(auth)
      .send({ title: 'Acme Energy — Procurement Transformation' })
      .expect(201);

    const deliveriesResponse = await request(app.getHttpServer())
      .get(
        `/api/v1/organizations/${owner.organization.id}/webhook-endpoints/${endpoint.id}/deliveries`,
      )
      .set(auth)
      .expect(200);
    const deliveries = (deliveriesResponse.body as ApiSuccessResponse<WebhookDeliveryResponse[]>)
      .data;
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0].eventType).toBe('sales.lead.created');
    expect(deliveries[0].attemptCount).toBeGreaterThanOrEqual(1);
    // Redis is disabled in the test environment, so exactly one real
    // attempt is made against example.com — which has no webhook
    // receiver, so it can never return 2xx. The delivery is therefore
    // exhausted (not endlessly retried) after that single real attempt.
    expect(['FAILED', 'EXHAUSTED']).toContain(deliveries[0].status);
    expect(deliveries[0].responseStatusCode).not.toBeNull();

    const replayResponse = await request(app.getHttpServer())
      .post(
        `/api/v1/organizations/${owner.organization.id}/webhook-endpoints/${endpoint.id}/deliveries/${deliveries[0].id}/replay`,
      )
      .set(auth)
      .expect(201);
    const replay = (replayResponse.body as ApiSuccessResponse<WebhookDeliveryResponse>).data;
    expect(replay.id).not.toBe(deliveries[0].id);
    expect(replay.eventType).toBe('sales.lead.created');

    const deliveriesAfterReplay = await request(app.getHttpServer())
      .get(
        `/api/v1/organizations/${owner.organization.id}/webhook-endpoints/${endpoint.id}/deliveries`,
      )
      .set(auth)
      .expect(200);
    const afterReplay = (
      deliveriesAfterReplay.body as ApiSuccessResponse<WebhookDeliveryResponse[]>
    ).data;
    expect(afterReplay).toHaveLength(2);
    // The original delivery's own row is untouched by the replay.
    const original = afterReplay.find((d) => d.id === deliveries[0].id);
    expect(original?.attemptCount).toBe(deliveries[0].attemptCount);
  });

  it('rejects registering a non-https endpoint URL', async () => {
    const owner = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `webhook-insecure-${Date.now()}@example.com`,
    });

    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${owner.organization.id}/webhook-endpoints`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ url: 'http://example.com/hook', eventTypes: ['sales.lead.created'] })
      .expect(400);
  });

  it('rejects registering an endpoint with an unknown event type', async () => {
    const owner = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `webhook-unknown-event-${Date.now()}@example.com`,
    });

    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${owner.organization.id}/webhook-endpoints`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ url: ENDPOINT_URL, eventTypes: ['not.a.real.event'] })
      .expect(400);
  });

  it('never lets a webhook endpoint registered in one organization be listed from another', async () => {
    const orgA = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `webhook-isolation-a-${Date.now()}@example.com`,
    });
    const orgB = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `webhook-isolation-b-${Date.now()}@example.com`,
    });

    await registerEndpoint(orgA.accessToken, orgA.organization.id);

    const listAsB = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgB.organization.id}/webhook-endpoints`)
      .set('Authorization', `Bearer ${orgB.accessToken}`)
      .expect(200);
    expect((listAsB.body as ApiSuccessResponse<unknown[]>).data).toEqual([]);

    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgA.organization.id}/webhook-endpoints`)
      .set('Authorization', `Bearer ${orgB.accessToken}`)
      .expect(403);
  });

  it('rejects a viewer from registering a webhook endpoint', async () => {
    const viewer = await authenticateContext(app, prisma, usersRepository, 'viewer', {
      email: `webhook-viewer-${Date.now()}@example.com`,
    });

    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${viewer.organization.id}/webhook-endpoints`)
      .set('Authorization', `Bearer ${viewer.accessToken}`)
      .send({ url: ENDPOINT_URL, eventTypes: ['sales.lead.created'] })
      .expect(403);
  });
});
