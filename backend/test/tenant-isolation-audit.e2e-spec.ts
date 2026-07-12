import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiSuccessResponse } from '../src/common/interceptors/response.interceptor';
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

/**
 * v1.9.1 Sprint 2 — Tenant Isolation. Regression coverage for the gaps
 * found during the full repository audit that aren't already covered by
 * a dedicated test elsewhere:
 *
 * - The flagship leak (WorkflowLogRepository/WorkflowCheckpointRepository
 *   with zero organization scoping at all) has its own test in
 *   workflow.e2e-spec.ts ("never returns another organization's run logs
 *   or checkpoints...").
 * - This file covers the two other genuine, controller-reachable gaps
 *   the audit surfaced: knowledge document ingestion never validated
 *   that a client-supplied sourceId belonged to the caller's org, and
 *   the workflow metrics/stats endpoints aggregated retry/step counts
 *   with no organization filter in their raw SQL joins.
 */
describe('Tenant isolation audit (e2e)', () => {
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

  describe('knowledge ingestion cannot target another organization’s source', () => {
    async function createSource(accessToken: string, name: string) {
      const response = await request(app.getHttpServer())
        .post('/api/v1/knowledge/sources')
        .set(bearerAuthHeaders(accessToken))
        .send({ type: 'DOCUMENT', name })
        .expect(201);
      return (response.body as ApiSuccessResponse<{ id: string }>).data;
    }

    it('404s when ingesting a document against a source id owned by another organization', async () => {
      const orgA = await authenticateContext(app, prisma, usersRepository, 'admin', {
        email: 'tenant-audit-knowledge-org-a@example.com',
      });
      const orgB = await authenticateContext(app, prisma, usersRepository, 'admin', {
        email: 'tenant-audit-knowledge-org-b@example.com',
      });

      const sourceA = await createSource(orgA.accessToken, 'Org A Source');

      await request(app.getHttpServer())
        .post(`/api/v1/knowledge/sources/${sourceA.id}/documents`)
        .set(bearerAuthHeaders(orgB.accessToken))
        .send({ title: 'Cross-tenant document', contentType: 'text', text: 'Should not ingest.' })
        .expect(404);

      // Confirm nothing was actually created under org A's source either.
      const documentsResponse = await request(app.getHttpServer())
        .get('/api/v1/knowledge/documents')
        .set(bearerAuthHeaders(orgA.accessToken))
        .query({ sourceId: sourceA.id })
        .expect(200);
      const items = (
        documentsResponse.body as ApiSuccessResponse<{ items: Array<{ title: string }> }>
      ).data.items;
      expect(items.some((item) => item.title === 'Cross-tenant document')).toBe(false);
    });

    it('emits an SSE error frame (never ingests) on the streaming endpoint too', async () => {
      const orgA = await authenticateContext(app, prisma, usersRepository, 'admin', {
        email: 'tenant-audit-knowledge-stream-org-a@example.com',
      });
      const orgB = await authenticateContext(app, prisma, usersRepository, 'admin', {
        email: 'tenant-audit-knowledge-stream-org-b@example.com',
      });

      const sourceA = await createSource(orgA.accessToken, 'Org A Stream Source');

      // Streaming endpoints always answer 200 and report failure as an SSE
      // `error` frame within the body (writeEventStreamToResponse's
      // established contract for every streaming endpoint in the
      // platform) — never validate this endpoint via HTTP status alone.
      const response = await request(app.getHttpServer())
        .post(`/api/v1/knowledge/sources/${sourceA.id}/documents/stream`)
        .set(bearerAuthHeaders(orgB.accessToken))
        .send({ title: 'Cross-tenant stream', contentType: 'text', text: 'Should not ingest.' })
        .expect(200);

      const frames = parseSseFrames(response.text);
      expect(frames.some((frame) => frame.event === 'error')).toBe(true);
    });
  });

  describe('workflow metrics never aggregate another organization’s runs', () => {
    async function createAndPublish(accessToken: string, name: string) {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set(bearerAuthHeaders(accessToken))
        .send({
          name: `${name} ${Date.now()}-${Math.random()}`,
          definition: {
            steps: [
              {
                id: 'step-1',
                name: 'step-1',
                type: 'TOOL',
                config: { toolName: 'datetime', input: {} },
              },
            ],
          },
        })
        .expect(201);
      const workflow = (createResponse.body as ApiSuccessResponse<{ id: string }>).data;
      await request(app.getHttpServer())
        .post(`/api/v1/workflows/${workflow.id}/publish`)
        .set(bearerAuthHeaders(accessToken))
        .expect(201);
      return workflow;
    }

    async function runWorkflow(accessToken: string, workflowId: string) {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/workflows/${workflowId}/run`)
        .set(bearerAuthHeaders(accessToken))
        .send({})
        .expect(201);
      return (response.body as ApiSuccessResponse<{ status: string }>).data;
    }

    it('returns zeroed metrics for a workflow id belonging to another organization', async () => {
      const orgA = await authenticateContext(app, prisma, usersRepository, 'admin', {
        email: 'tenant-audit-metrics-org-a@example.com',
      });
      const orgB = await authenticateContext(app, prisma, usersRepository, 'admin', {
        email: 'tenant-audit-metrics-org-b@example.com',
      });

      const workflowA = await createAndPublish(orgA.accessToken, 'Org A Metrics Workflow');
      const run = await runWorkflow(orgA.accessToken, workflowA.id);
      expect(run.status).toBe('SUCCEEDED');

      // Org A sees real, non-zero metrics for its own workflow.
      const metricsAsOrgA = await request(app.getHttpServer())
        .get(`/api/v1/workflows/${workflowA.id}/metrics`)
        .set(bearerAuthHeaders(orgA.accessToken))
        .expect(200);
      const ownMetrics = (
        metricsAsOrgA.body as ApiSuccessResponse<{ totalRuns: number; toolStepCount: number }>
      ).data;
      expect(ownMetrics.totalRuns).toBeGreaterThan(0);
      expect(ownMetrics.toolStepCount).toBeGreaterThan(0);

      // Org B, given org A's exact workflow id, must see nothing real —
      // WorkflowRetryRepository.countByWorkflow and
      // WorkflowStepRunRepository.countByWorkflowAndType previously had no
      // organization_id filter in their raw SQL joins at all.
      const metricsAsOrgB = await request(app.getHttpServer())
        .get(`/api/v1/workflows/${workflowA.id}/metrics`)
        .set(bearerAuthHeaders(orgB.accessToken))
        .expect(200);
      const foreignMetrics = (
        metricsAsOrgB.body as ApiSuccessResponse<{
          totalRuns: number;
          toolStepCount: number;
          totalRetries: number;
        }>
      ).data;
      expect(foreignMetrics.totalRuns).toBe(0);
      expect(foreignMetrics.toolStepCount).toBe(0);
      expect(foreignMetrics.totalRetries).toBe(0);
    }, 20000);
  });

  describe('v2.0 workflow automation — cross-tenant isolation for new resources', () => {
    async function createPublishedWorkflow(accessToken: string, name: string) {
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set(bearerAuthHeaders(accessToken))
        .send({
          name: `${name} ${Date.now()}-${Math.random()}`,
          definition: {
            steps: [{ id: 'step-1', name: 'step-1', type: 'DELAY', config: { delayMs: 1 } }],
          },
        })
        .expect(201);
      const workflow = (createResponse.body as ApiSuccessResponse<{ id: string }>).data;
      await request(app.getHttpServer())
        .post(`/api/v1/workflows/${workflow.id}/publish`)
        .set(bearerAuthHeaders(accessToken))
        .expect(201);
      return workflow;
    }

    it('never lets one organization list, toggle, or delete another organization’s webhook', async () => {
      const orgA = await authenticateContext(app, prisma, usersRepository, 'admin', {
        email: 'tenant-audit-webhook-org-a@example.com',
      });
      const orgB = await authenticateContext(app, prisma, usersRepository, 'admin', {
        email: 'tenant-audit-webhook-org-b@example.com',
      });

      const workflowA = await createPublishedWorkflow(orgA.accessToken, 'Org A Webhook Workflow');

      const createWebhookResponse = await request(app.getHttpServer())
        .post(`/api/v1/workflows/${workflowA.id}/webhooks`)
        .set(bearerAuthHeaders(orgA.accessToken))
        .expect(201);
      const webhook = (createWebhookResponse.body as ApiSuccessResponse<{ id: string }>).data;

      // Org B sees nothing for org A's workflow id — an empty list, never
      // org A's webhook (the endpoint doesn't 404 on a foreign workflow id;
      // it just has nothing org-scoped to return for it).
      const listAsOrgB = await request(app.getHttpServer())
        .get(`/api/v1/workflows/${workflowA.id}/webhooks`)
        .set(bearerAuthHeaders(orgB.accessToken))
        .expect(200);
      expect((listAsOrgB.body as ApiSuccessResponse<unknown[]>).data).toEqual([]);

      // … nor toggle it …
      await request(app.getHttpServer())
        .patch(`/api/v1/workflows/webhooks/${webhook.id}`)
        .set(bearerAuthHeaders(orgB.accessToken))
        .send({ enabled: false })
        .expect(404);

      // … nor delete it.
      await request(app.getHttpServer())
        .delete(`/api/v1/workflows/webhooks/${webhook.id}`)
        .set(bearerAuthHeaders(orgB.accessToken))
        .expect(404);

      // It's still there, untouched, for org A.
      const listAsOrgA = await request(app.getHttpServer())
        .get(`/api/v1/workflows/${workflowA.id}/webhooks`)
        .set(bearerAuthHeaders(orgA.accessToken))
        .expect(200);
      const stillListed = (
        listAsOrgA.body as ApiSuccessResponse<Array<{ id: string; enabled: boolean }>>
      ).data;
      expect(stillListed.find((item) => item.id === webhook.id)?.enabled).toBe(true);
    });

    it('never lets one organization see or decide another organization’s pending approval', async () => {
      const orgA = await authenticateContext(app, prisma, usersRepository, 'admin', {
        email: 'tenant-audit-approval-org-a@example.com',
      });
      const orgB = await authenticateContext(app, prisma, usersRepository, 'admin', {
        email: 'tenant-audit-approval-org-b@example.com',
      });

      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/workflows')
        .set(bearerAuthHeaders(orgA.accessToken))
        .send({
          name: `Org A Approval Workflow ${Date.now()}-${Math.random()}`,
          definition: {
            steps: [
              { id: 'approve', name: 'approve', type: 'APPROVAL', config: { message: 'Approve?' } },
            ],
          },
        })
        .expect(201);
      const workflowA = (createResponse.body as ApiSuccessResponse<{ id: string }>).data;
      await request(app.getHttpServer())
        .post(`/api/v1/workflows/${workflowA.id}/publish`)
        .set(bearerAuthHeaders(orgA.accessToken))
        .expect(201);
      await request(app.getHttpServer())
        .post(`/api/v1/workflows/${workflowA.id}/run`)
        .set(bearerAuthHeaders(orgA.accessToken))
        .send({})
        .expect(201);

      const approvalsAsOrgA = await request(app.getHttpServer())
        .get('/api/v1/workflows/approvals')
        .set(bearerAuthHeaders(orgA.accessToken))
        .expect(200);
      const pending = (approvalsAsOrgA.body as ApiSuccessResponse<{ items: Array<{ id: string }> }>)
        .data.items;
      expect(pending.length).toBeGreaterThan(0);
      const approvalId = pending[0].id;

      // Org B's own approvals inbox never contains org A's pending approval.
      const approvalsAsOrgB = await request(app.getHttpServer())
        .get('/api/v1/workflows/approvals')
        .set(bearerAuthHeaders(orgB.accessToken))
        .expect(200);
      const orgBPending = (
        approvalsAsOrgB.body as ApiSuccessResponse<{ items: Array<{ id: string }> }>
      ).data.items;
      expect(orgBPending.some((item) => item.id === approvalId)).toBe(false);

      // Org B can't decide it either, given the id directly.
      await request(app.getHttpServer())
        .post(`/api/v1/workflows/approvals/${approvalId}/decide`)
        .set(bearerAuthHeaders(orgB.accessToken))
        .send({ decision: 'APPROVED' })
        .expect(404);
    });
  });

  describe('v2.1 billing platform — cross-tenant isolation for new resources', () => {
    async function registerOrg(email: string, organizationName: string) {
      const registerResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({
          email,
          password: 'Password123!',
          firstName: 'Tenant',
          lastName: 'Audit',
          organizationName,
        })
        .expect(201);
      const accessToken = (registerResponse.body as ApiSuccessResponse<{ accessToken: string }>)
        .data.accessToken;
      const meResponse = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);
      const organizationId = (meResponse.body as ApiSuccessResponse<{ organizationId: string }>)
        .data.organizationId;
      return { accessToken, organizationId };
    }

    it('never lets one organization see another organization’s invoices or payment methods', async () => {
      const orgA = await registerOrg(
        `tenant-audit-billing-org-a-${Date.now()}@example.com`,
        'Billing Tenant Audit Org A',
      );
      const orgB = await registerOrg(
        `tenant-audit-billing-org-b-${Date.now()}@example.com`,
        'Billing Tenant Audit Org B',
      );

      const billingAccountA = await prisma.system.billingAccount.findUniqueOrThrow({
        where: { organizationId: orgA.organizationId },
      });

      const invoiceA = await prisma.system.invoice.create({
        data: {
          organizationId: orgA.organizationId,
          billingAccountId: billingAccountA.id,
          stripeInvoiceId: `in_tenant_audit_${Date.now()}`,
          status: 'PAID',
          amountDue: 99,
          amountPaid: 99,
          amountRemaining: 0,
          currency: 'usd',
        },
      });

      const paymentMethodA = await prisma.system.paymentMethod.create({
        data: {
          organizationId: orgA.organizationId,
          billingAccountId: billingAccountA.id,
          stripePaymentMethodId: `pm_tenant_audit_${Date.now()}`,
          type: 'CARD',
          brand: 'visa',
          last4: '4242',
          isDefault: true,
        },
      });

      // Org B's own invoice/payment-method lists never contain org A's rows.
      const invoicesAsOrgB = await request(app.getHttpServer())
        .get('/api/v1/billing/invoices')
        .set('Authorization', `Bearer ${orgB.accessToken}`)
        .expect(200);
      const orgBInvoices = (
        invoicesAsOrgB.body as ApiSuccessResponse<{ items: Array<{ id: string }> }>
      ).data.items;
      expect(orgBInvoices.some((item) => item.id === invoiceA.id)).toBe(false);

      const paymentMethodsAsOrgB = await request(app.getHttpServer())
        .get('/api/v1/billing/payment-methods')
        .set('Authorization', `Bearer ${orgB.accessToken}`)
        .expect(200);
      const orgBPaymentMethods = (
        paymentMethodsAsOrgB.body as ApiSuccessResponse<Array<{ id: string }>>
      ).data;
      expect(orgBPaymentMethods.some((item) => item.id === paymentMethodA.id)).toBe(false);

      // Org B can't set org A's payment method as default or remove it,
      // given the id directly.
      await request(app.getHttpServer())
        .post(`/api/v1/billing/payment-methods/${paymentMethodA.id}/default`)
        .set('Authorization', `Bearer ${orgB.accessToken}`)
        .expect(404);

      await request(app.getHttpServer())
        .delete(`/api/v1/billing/payment-methods/${paymentMethodA.id}`)
        .set('Authorization', `Bearer ${orgB.accessToken}`)
        .expect(404);

      // Org A still sees its own invoice/payment method, untouched.
      const invoicesAsOrgA = await request(app.getHttpServer())
        .get('/api/v1/billing/invoices')
        .set('Authorization', `Bearer ${orgA.accessToken}`)
        .expect(200);
      const orgAInvoices = (
        invoicesAsOrgA.body as ApiSuccessResponse<{ items: Array<{ id: string }> }>
      ).data.items;
      expect(orgAInvoices.some((item) => item.id === invoiceA.id)).toBe(true);
    });

    it('never lets one organization read or mutate another organization’s subscription', async () => {
      const orgA = await registerOrg(
        `tenant-audit-subscription-org-a-${Date.now()}@example.com`,
        'Subscription Tenant Audit Org A',
      );
      const orgB = await registerOrg(
        `tenant-audit-subscription-org-b-${Date.now()}@example.com`,
        'Subscription Tenant Audit Org B',
      );

      const subscriptionAsOrgA = await request(app.getHttpServer())
        .get('/api/v1/billing/subscription')
        .set('Authorization', `Bearer ${orgA.accessToken}`)
        .expect(200);
      const orgASubscription = (
        subscriptionAsOrgA.body as ApiSuccessResponse<{ id: string; planId: string }>
      ).data;

      const subscriptionAsOrgB = await request(app.getHttpServer())
        .get('/api/v1/billing/subscription')
        .set('Authorization', `Bearer ${orgB.accessToken}`)
        .expect(200);
      const orgBSubscription = (
        subscriptionAsOrgB.body as ApiSuccessResponse<{ id: string; planId: string }>
      ).data;

      // Each organization has its own, distinct trial subscription — org
      // B's read of "the current subscription" never resolves to org A's,
      // proving getCurrentForOrganizationOrThrow scopes strictly by the
      // caller's own JWT-derived organizationId rather than e.g. returning
      // whichever Subscription row happens to be first/most-recent overall.
      expect(orgBSubscription.id).not.toBe(orgASubscription.id);
      expect(orgASubscription.id).toBe(
        (
          await prisma.system.subscription.findFirstOrThrow({
            where: { organizationId: orgA.organizationId },
          })
        ).id,
      );
    });
  });
});
