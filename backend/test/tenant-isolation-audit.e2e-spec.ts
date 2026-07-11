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
});
