import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { NotificationCategory } from '@prisma/client';
import { ApiSuccessResponse } from '../src/common/interceptors/response.interceptor';
import { PrismaService } from '../src/database/prisma.service';
import { UsersRepository } from '../src/modules/users/users.repository';
import { createTestApp } from './create-test-app';
import {
  authenticateContext,
  bearerAuthHeaders,
  resetAndSeedAuthTestData,
} from './helpers/users-test.helper';

interface ErrorResponseBody {
  success: false;
  error: { code: string; message: string; details?: unknown };
}

interface LegalHoldResponse {
  id: string;
  status: string;
  targetUserId: string | null;
}

interface GdprExportResponse {
  downloadUrl: string;
  sections: { model: string; label: string; rowCount: number }[];
  excludedFromErasure: string[];
}

interface GdprDeletionResponse {
  results: { model: string; action: string; affected: number }[];
  globalIdentityScrubbed: boolean;
}

interface AuditVerifyResponse {
  valid: boolean;
  checked: number;
  brokenAtIndex: number | null;
  brokenAuditLogId: string | null;
}

interface ConsentRecordResponse {
  id: string;
  granted: boolean;
  consentType: string;
}

/**
 * v2.2 Phase 5 — Compliance Center. Covers the five scenarios called out
 * in the phase plan: hash-chain tamper detection, legal-hold blocking
 * erasure, GDPR export completeness, consent grant/revoke history, and
 * cross-tenant isolation.
 */
describe('Compliance Center (e2e)', () => {
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

  describe('audit hash-chain integrity', () => {
    it('reports a valid chain after a handful of ordinary authenticated actions', async () => {
      const admin = await authenticateContext(app, prisma, usersRepository, 'admin', {
        email: `audit-verify-valid-${Date.now()}@example.com`,
      });

      // Generate a couple of audit log rows via ordinary authenticated activity.
      await request(app.getHttpServer())
        .post('/api/v1/compliance/legal-holds')
        .set(bearerAuthHeaders(admin.accessToken))
        .send({ name: 'Matter A', reason: 'Routine hold for verify test' })
        .expect(201);
      await request(app.getHttpServer())
        .post('/api/v1/compliance/consent-records')
        .set(bearerAuthHeaders(admin.accessToken))
        .send({ userId: admin.user.id, consentType: 'terms_of_service', granted: true })
        .expect(201);

      const response = await request(app.getHttpServer())
        .get('/api/v1/compliance/audit/verify')
        .set(bearerAuthHeaders(admin.accessToken))
        .expect(200);

      const body = (response.body as ApiSuccessResponse<AuditVerifyResponse>).data;
      expect(body.valid).toBe(true);
      expect(body.checked).toBeGreaterThan(0);
      expect(body.brokenAtIndex).toBeNull();
    });

    it('detects a tampered audit log row and reports the first broken index', async () => {
      const admin = await authenticateContext(app, prisma, usersRepository, 'admin', {
        email: `audit-verify-tamper-${Date.now()}@example.com`,
      });

      await request(app.getHttpServer())
        .post('/api/v1/compliance/legal-holds')
        .set(bearerAuthHeaders(admin.accessToken))
        .send({ name: 'Matter B', reason: 'First hold' })
        .expect(201);
      await request(app.getHttpServer())
        .post('/api/v1/compliance/legal-holds')
        .set(bearerAuthHeaders(admin.accessToken))
        .send({ name: 'Matter C', reason: 'Second hold' })
        .expect(201);

      const rows = await prisma.system.auditLog.findMany({
        where: { organizationId: admin.organization.id, hash: { not: null } },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      });
      expect(rows.length).toBeGreaterThanOrEqual(2);

      // Directly mutate a historical row's action, bypassing AuditRepository
      // entirely — simulating an attacker (or a bug) editing the table
      // outside the normal write path.
      const tamperedRow = rows[0];
      await prisma.system.auditLog.update({
        where: { id: tamperedRow.id },
        data: { action: 'tampered.action' },
      });

      const response = await request(app.getHttpServer())
        .get('/api/v1/compliance/audit/verify')
        .set(bearerAuthHeaders(admin.accessToken))
        .expect(200);

      const body = (response.body as ApiSuccessResponse<AuditVerifyResponse>).data;
      expect(body.valid).toBe(false);
      expect(body.brokenAuditLogId).toBe(tamperedRow.id);
    });
  });

  describe('legal holds block GDPR erasure', () => {
    it('blocks /compliance/gdpr/delete for a user with an active targeted legal hold', async () => {
      const admin = await authenticateContext(app, prisma, usersRepository, 'admin', {
        email: `legalhold-admin-${Date.now()}@example.com`,
      });
      const member = await authenticateContext(app, prisma, usersRepository, 'member', {
        email: `legalhold-target-${Date.now()}@example.com`,
      });
      // Same organization as admin so the membership check passes.
      await prisma.system.membership.updateMany({
        where: { userId: member.user.id },
        data: { organizationId: admin.organization.id },
      });

      const holdResponse = await request(app.getHttpServer())
        .post('/api/v1/compliance/legal-holds')
        .set(bearerAuthHeaders(admin.accessToken))
        .send({
          name: 'HR Investigation',
          reason: 'Pending internal review',
          targetUserId: member.user.id,
        })
        .expect(201);
      const hold = (holdResponse.body as ApiSuccessResponse<LegalHoldResponse>).data;
      expect(hold.status).toBe('ACTIVE');

      const deleteResponse = await request(app.getHttpServer())
        .post('/api/v1/compliance/gdpr/delete')
        .set(bearerAuthHeaders(admin.accessToken))
        .send({ userId: member.user.id })
        .expect(409);
      expect((deleteResponse.body as ErrorResponseBody).success).toBe(false);

      // Releasing the hold un-blocks erasure.
      await request(app.getHttpServer())
        .post(`/api/v1/compliance/legal-holds/${hold.id}/release`)
        .set(bearerAuthHeaders(admin.accessToken))
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/v1/compliance/gdpr/delete')
        .set(bearerAuthHeaders(admin.accessToken))
        .send({ userId: member.user.id })
        .expect(201);
    });
  });

  describe('GDPR export completeness', () => {
    it('includes org-scoped personal data (e.g. notifications) for the target user', async () => {
      const admin = await authenticateContext(app, prisma, usersRepository, 'admin', {
        email: `gdpr-export-admin-${Date.now()}@example.com`,
      });
      const member = await authenticateContext(app, prisma, usersRepository, 'member', {
        email: `gdpr-export-target-${Date.now()}@example.com`,
      });
      await prisma.system.membership.updateMany({
        where: { userId: member.user.id },
        data: { organizationId: admin.organization.id },
      });

      await prisma.system.notification.create({
        data: {
          organizationId: admin.organization.id,
          userId: member.user.id,
          category: NotificationCategory.MESSAGE,
          title: 'Welcome',
        },
      });

      const response = await request(app.getHttpServer())
        .post('/api/v1/compliance/gdpr/export')
        .set(bearerAuthHeaders(admin.accessToken))
        .send({ userId: member.user.id })
        .expect(201);

      const body = (response.body as ApiSuccessResponse<GdprExportResponse>).data;
      expect(body.downloadUrl).toBeTruthy();

      const notificationSection = body.sections.find((section) => section.model === 'notification');
      expect(notificationSection?.rowCount).toBe(1);

      const membershipSection = body.sections.find((section) => section.model === 'membership');
      expect(membershipSection?.rowCount).toBeGreaterThanOrEqual(1);

      // Documented exclusions (e.g. AuditLog, CommsMessage) are surfaced, not silently dropped.
      expect(body.excludedFromErasure.length).toBeGreaterThan(0);
    });

    it('actually removes the exported data on a subsequent erasure request', async () => {
      const admin = await authenticateContext(app, prisma, usersRepository, 'admin', {
        email: `gdpr-erase-admin-${Date.now()}@example.com`,
      });
      const member = await authenticateContext(app, prisma, usersRepository, 'member', {
        email: `gdpr-erase-target-${Date.now()}@example.com`,
      });
      await prisma.system.membership.updateMany({
        where: { userId: member.user.id },
        data: { organizationId: admin.organization.id },
      });

      await prisma.system.notification.create({
        data: {
          organizationId: admin.organization.id,
          userId: member.user.id,
          category: NotificationCategory.MESSAGE,
          title: 'Welcome',
        },
      });

      const response = await request(app.getHttpServer())
        .post('/api/v1/compliance/gdpr/delete')
        .set(bearerAuthHeaders(admin.accessToken))
        .send({ userId: member.user.id })
        .expect(201);

      const body = (response.body as ApiSuccessResponse<GdprDeletionResponse>).data;
      const notificationOutcome = body.results.find((result) => result.model === 'notification');
      expect(notificationOutcome?.action).toBe('DELETE');
      expect(notificationOutcome?.affected).toBe(1);

      const remaining = await prisma.system.notification.count({
        where: { userId: member.user.id },
      });
      expect(remaining).toBe(0);

      // This was the member's only membership, so the global identity is scrubbed too.
      expect(body.globalIdentityScrubbed).toBe(true);
      const scrubbedUser = await prisma.system.user.findUniqueOrThrow({
        where: { id: member.user.id },
      });
      expect(scrubbedUser.email).toContain('@erased.invalid');
      expect(scrubbedUser.passwordHash).toBeNull();
    });
  });

  describe('consent grant/revoke history', () => {
    it('appends a new row per grant/revoke and preserves the full history', async () => {
      const admin = await authenticateContext(app, prisma, usersRepository, 'admin', {
        email: `consent-admin-${Date.now()}@example.com`,
      });

      await request(app.getHttpServer())
        .post('/api/v1/compliance/consent-records')
        .set(bearerAuthHeaders(admin.accessToken))
        .send({ userId: admin.user.id, consentType: 'marketing_emails', granted: true })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/v1/compliance/consent-records')
        .set(bearerAuthHeaders(admin.accessToken))
        .send({ userId: admin.user.id, consentType: 'marketing_emails', granted: false })
        .expect(201);

      const historyResponse = await request(app.getHttpServer())
        .get('/api/v1/compliance/consent-records')
        .query({ userId: admin.user.id, consentType: 'marketing_emails' })
        .set(bearerAuthHeaders(admin.accessToken))
        .expect(200);

      const history = (historyResponse.body as ApiSuccessResponse<ConsentRecordResponse[]>).data;
      expect(history).toHaveLength(2);
      // Most recent first (revoke), then the original grant.
      expect(history[0].granted).toBe(false);
      expect(history[1].granted).toBe(true);
    });
  });

  describe('cross-tenant isolation', () => {
    it("never returns another organization's legal holds, and audit verify never crosses organizations", async () => {
      const ownerA = await authenticateContext(app, prisma, usersRepository, 'admin', {
        email: `compliance-org-a-${Date.now()}@example.com`,
      });
      const ownerB = await authenticateContext(app, prisma, usersRepository, 'admin', {
        email: `compliance-org-b-${Date.now()}@example.com`,
      });

      const holdResponse = await request(app.getHttpServer())
        .post('/api/v1/compliance/legal-holds')
        .set(bearerAuthHeaders(ownerA.accessToken))
        .send({ name: 'Org A Only Matter', reason: 'Confidential to org A' })
        .expect(201);
      const hold = (holdResponse.body as ApiSuccessResponse<LegalHoldResponse>).data;

      // Org B cannot see org A's legal hold list...
      const listAsB = await request(app.getHttpServer())
        .get('/api/v1/compliance/legal-holds')
        .set(bearerAuthHeaders(ownerB.accessToken))
        .expect(200);
      const holdsForB = (listAsB.body as ApiSuccessResponse<LegalHoldResponse[]>).data;
      expect(holdsForB.find((item) => item.id === hold.id)).toBeUndefined();

      // ...nor fetch it directly by id.
      await request(app.getHttpServer())
        .get(`/api/v1/compliance/legal-holds/${hold.id}`)
        .set(bearerAuthHeaders(ownerB.accessToken))
        .expect(404);

      // Audit verify for org B only ever walks org B's own chain.
      await request(app.getHttpServer())
        .post('/api/v1/compliance/legal-holds')
        .set(bearerAuthHeaders(ownerB.accessToken))
        .send({ name: 'Org B Only Matter', reason: 'Confidential to org B' })
        .expect(201);

      const verifyAsB = await request(app.getHttpServer())
        .get('/api/v1/compliance/audit/verify')
        .set(bearerAuthHeaders(ownerB.accessToken))
        .expect(200);
      const verifyBody = (verifyAsB.body as ApiSuccessResponse<AuditVerifyResponse>).data;
      expect(verifyBody.valid).toBe(true);

      const orgALogCount = await prisma.system.auditLog.count({
        where: { organizationId: ownerA.organization.id },
      });
      const orgBLogCount = await prisma.system.auditLog.count({
        where: { organizationId: ownerB.organization.id },
      });
      expect(orgALogCount).toBeGreaterThan(0);
      expect(orgBLogCount).toBeGreaterThan(0);
      // The two organizations' chains never share a hash value.
      const orgAHashes = new Set(
        (
          await prisma.system.auditLog.findMany({
            where: { organizationId: ownerA.organization.id },
            select: { hash: true },
          })
        ).map((row) => row.hash),
      );
      const orgBHashes = (
        await prisma.system.auditLog.findMany({
          where: { organizationId: ownerB.organization.id },
          select: { hash: true },
        })
      ).map((row) => row.hash);
      for (const hash of orgBHashes) {
        expect(orgAHashes.has(hash)).toBe(false);
      }
    });

    it('blocks a non-admin member from managing compliance resources via RBAC', async () => {
      const member = await authenticateContext(app, prisma, usersRepository, 'member', {
        email: `compliance-member-${Date.now()}@example.com`,
      });

      await request(app.getHttpServer())
        .post('/api/v1/compliance/legal-holds')
        .set(bearerAuthHeaders(member.accessToken))
        .send({ name: 'Should not be allowed', reason: 'n/a' })
        .expect(403);

      await request(app.getHttpServer())
        .post('/api/v1/compliance/gdpr/export')
        .set(bearerAuthHeaders(member.accessToken))
        .send({ userId: member.user.id })
        .expect(403);
    });
  });
});
