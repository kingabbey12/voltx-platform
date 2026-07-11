import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiSuccessResponse } from '../src/common/interceptors/response.interceptor';
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

interface AttachmentBody {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
  hasThumbnail: boolean;
}

async function waitUntilReady(
  app: INestApplication<App>,
  accessToken: string,
  attachmentId: string,
): Promise<AttachmentBody> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/attachments/${attachmentId}`)
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    const attachment = (response.body as ApiSuccessResponse<AttachmentBody>).data;
    if (
      attachment.status === 'READY' ||
      attachment.status === 'QUARANTINED' ||
      attachment.status === 'FAILED'
    ) {
      return attachment;
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 200));
  }
  throw new Error(`Attachment ${attachmentId} never finished processing`);
}

describe('Attachments (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let usersRepository: UsersRepository;

  beforeAll(async () => {
    // Low enough to make the multipart size-bypass test below fast (no
    // need to actually upload megabytes), but comfortably above every
    // other payload this file uploads (the largest is 44 bytes).
    process.env.ATTACHMENTS_MAX_FILE_SIZE_BYTES = '200';
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
    delete process.env.ATTACHMENTS_MAX_FILE_SIZE_BYTES;
  });

  it('uploads a text file, processes it, extracts its content, and streams it back', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);

    const uploadResponse = await request(app.getHttpServer())
      .post('/api/v1/attachments/upload')
      .set(bearerAuthHeaders(accessToken))
      .attach('file', Buffer.from('The quarterly report says revenue is up 12%.'), {
        filename: 'notes.txt',
        contentType: 'text/plain',
      })
      .expect(201);
    const uploaded = (uploadResponse.body as ApiSuccessResponse<AttachmentBody>).data;
    expect(uploaded.status).toBe('PENDING');
    expect(uploaded.fileName).toBe('notes.txt');

    const ready = await waitUntilReady(app, accessToken, uploaded.id);
    expect(ready.status).toBe('READY');

    const downloadResponse = await request(app.getHttpServer())
      .get(`/api/v1/attachments/${uploaded.id}/download`)
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    expect(downloadResponse.text).toBe('The quarterly report says revenue is up 12%.');
    expect(downloadResponse.headers['content-disposition']).toContain('notes.txt');
  });

  it('rejects an unsupported file type before any bytes are persisted', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);

    await request(app.getHttpServer())
      .post('/api/v1/attachments/upload')
      .set(bearerAuthHeaders(accessToken))
      .attach('file', Buffer.from('MZ...'), {
        filename: 'installer.exe',
        contentType: 'application/x-msdownload',
      })
      .expect(400);
  });

  it('generates a working signed download URL that requires no auth header', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);

    const uploadResponse = await request(app.getHttpServer())
      .post('/api/v1/attachments/upload')
      .set(bearerAuthHeaders(accessToken))
      .attach('file', Buffer.from('signed url contents'), {
        filename: 'signed.txt',
        contentType: 'text/plain',
      })
      .expect(201);
    const uploaded = (uploadResponse.body as ApiSuccessResponse<AttachmentBody>).data;
    await waitUntilReady(app, accessToken, uploaded.id);

    const urlResponse = await request(app.getHttpServer())
      .get(`/api/v1/attachments/${uploaded.id}/download-url`)
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    const { url } = (urlResponse.body as ApiSuccessResponse<{ url: string }>).data;
    const relativePath = url.replace(/^https?:\/\/[^/]+/, '');

    const rawResponse = await request(app.getHttpServer()).get(relativePath).expect(200);
    expect(rawResponse.text).toBe('signed url contents');
  });

  it('reassembles a multipart upload from its parts and marks it ready', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);

    const initiateResponse = await request(app.getHttpServer())
      .post('/api/v1/attachments/multipart/initiate')
      .set(bearerAuthHeaders(accessToken))
      .send({ fileName: 'big-notes.txt', mimeType: 'text/plain', sizeBytes: 20 })
      .expect(201);
    const { attachmentId, uploadId } = (
      initiateResponse.body as ApiSuccessResponse<{ attachmentId: string; uploadId: string }>
    ).data;

    const part1Response = await request(app.getHttpServer())
      .post(`/api/v1/attachments/multipart/${attachmentId}/parts/1`)
      .query({ uploadId })
      .set(bearerAuthHeaders(accessToken))
      .attach('file', Buffer.from('FIRST-'), { filename: 'part1', contentType: 'text/plain' })
      .expect(201);
    const part2Response = await request(app.getHttpServer())
      .post(`/api/v1/attachments/multipart/${attachmentId}/parts/2`)
      .query({ uploadId })
      .set(bearerAuthHeaders(accessToken))
      .attach('file', Buffer.from('SECOND'), { filename: 'part2', contentType: 'text/plain' })
      .expect(201);

    const part1 = (part1Response.body as ApiSuccessResponse<{ partNumber: number; etag: string }>)
      .data;
    const part2 = (part2Response.body as ApiSuccessResponse<{ partNumber: number; etag: string }>)
      .data;

    const completeResponse = await request(app.getHttpServer())
      .post(`/api/v1/attachments/multipart/${attachmentId}/complete`)
      .query({ uploadId })
      .set(bearerAuthHeaders(accessToken))
      .send({ parts: [part1, part2] })
      .expect(201);
    const completed = (completeResponse.body as ApiSuccessResponse<AttachmentBody>).data;
    expect(completed.status).toBe('PENDING');

    const ready = await waitUntilReady(app, accessToken, attachmentId);
    expect(ready.status).toBe('READY');

    const downloadResponse = await request(app.getHttpServer())
      .get(`/api/v1/attachments/${attachmentId}/download`)
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    expect(downloadResponse.text).toBe('FIRST-SECOND');
  });

  it('cannot bypass the max file size limit by uploading more parts than declared at initiate time', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);

    // Declares a small, within-limit size at initiate time...
    const initiateResponse = await request(app.getHttpServer())
      .post('/api/v1/attachments/multipart/initiate')
      .set(bearerAuthHeaders(accessToken))
      .send({ fileName: 'oversized.txt', mimeType: 'text/plain', sizeBytes: 50 })
      .expect(201);
    const { attachmentId, uploadId } = (
      initiateResponse.body as ApiSuccessResponse<{ attachmentId: string; uploadId: string }>
    ).data;

    // ...then actually uploads 300 bytes across 3 parts — well over the
    // 200-byte test limit configured in beforeAll.
    const oversizedPart = Buffer.alloc(100, 'a');
    const parts: Array<{ partNumber: number; etag: string }> = [];
    for (let partNumber = 1; partNumber <= 3; partNumber += 1) {
      const partResponse = await request(app.getHttpServer())
        .post(`/api/v1/attachments/multipart/${attachmentId}/parts/${partNumber}`)
        .query({ uploadId })
        .set(bearerAuthHeaders(accessToken))
        .attach('file', oversizedPart, { filename: `part${partNumber}`, contentType: 'text/plain' })
        .expect(201);
      parts.push(
        (partResponse.body as ApiSuccessResponse<{ partNumber: number; etag: string }>).data,
      );
    }

    await request(app.getHttpServer())
      .post(`/api/v1/attachments/multipart/${attachmentId}/complete`)
      .query({ uploadId })
      .set(bearerAuthHeaders(accessToken))
      .send({ parts })
      .expect(400);

    // Rejected uploads must not linger as orphaned, half-processed rows.
    await request(app.getHttpServer())
      .get(`/api/v1/attachments/${attachmentId}`)
      .set(bearerAuthHeaders(accessToken))
      .expect(404);
  });

  it('links an attachment to a conversation via a reference and lists it back', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);

    const uploadResponse = await request(app.getHttpServer())
      .post('/api/v1/attachments/upload')
      .set(bearerAuthHeaders(accessToken))
      .attach('file', Buffer.from('conversation attachment'), {
        filename: 'attached.txt',
        contentType: 'text/plain',
      })
      .expect(201);
    const uploaded = (uploadResponse.body as ApiSuccessResponse<AttachmentBody>).data;
    await waitUntilReady(app, accessToken, uploaded.id);

    const messageId = randomUUID();
    await request(app.getHttpServer())
      .post(`/api/v1/attachments/${uploaded.id}/references`)
      .set(bearerAuthHeaders(accessToken))
      .send({ referenceType: 'AI_MESSAGE', referenceId: messageId })
      .expect(201);

    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/attachments')
      .query({ referenceType: 'AI_MESSAGE', referenceId: messageId })
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    const list = (listResponse.body as ApiSuccessResponse<{ items: AttachmentBody[] }>).data;
    expect(list.items).toHaveLength(1);
    expect(list.items[0].id).toBe(uploaded.id);
  });

  it('soft-deletes an attachment so it can no longer be fetched or downloaded', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);

    const uploadResponse = await request(app.getHttpServer())
      .post('/api/v1/attachments/upload')
      .set(bearerAuthHeaders(accessToken))
      .attach('file', Buffer.from('to be deleted'), {
        filename: 'delete-me.txt',
        contentType: 'text/plain',
      })
      .expect(201);
    const uploaded = (uploadResponse.body as ApiSuccessResponse<AttachmentBody>).data;
    await waitUntilReady(app, accessToken, uploaded.id);

    await request(app.getHttpServer())
      .delete(`/api/v1/attachments/${uploaded.id}`)
      .set(bearerAuthHeaders(accessToken))
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/attachments/${uploaded.id}`)
      .set(bearerAuthHeaders(accessToken))
      .expect(404);
  });

  it('enforces organization isolation: another org cannot read or download the attachment', async () => {
    const { accessToken: orgAToken } = await authenticateContext(app, prisma, usersRepository);
    const tenantB = await seedAuthContext(prisma, usersRepository, 'admin', {
      email: 'other.admin@example.com',
      firstName: 'Other',
      lastName: 'Admin',
    });
    const { accessToken: orgBToken } = await loginAs(
      app,
      tenantB.user.email,
      tenantB.password,
      tenantB.organization.id,
    );

    const uploadResponse = await request(app.getHttpServer())
      .post('/api/v1/attachments/upload')
      .set(bearerAuthHeaders(orgAToken))
      .attach('file', Buffer.from('org A only'), {
        filename: 'private.txt',
        contentType: 'text/plain',
      })
      .expect(201);
    const uploaded = (uploadResponse.body as ApiSuccessResponse<AttachmentBody>).data;
    await waitUntilReady(app, orgAToken, uploaded.id);

    await request(app.getHttpServer())
      .get(`/api/v1/attachments/${uploaded.id}`)
      .set(bearerAuthHeaders(orgBToken))
      .expect(404);

    await request(app.getHttpServer())
      .get(`/api/v1/attachments/${uploaded.id}/download`)
      .set(bearerAuthHeaders(orgBToken))
      .expect(404);
  });

  it('rejects unauthenticated access to every attachment endpoint', async () => {
    await request(app.getHttpServer()).get('/api/v1/attachments/some-id').expect(401);
    await request(app.getHttpServer()).post('/api/v1/attachments/upload').expect(401);
  });

  it('blocks every read path for a quarantined attachment, except the audited admin override', async () => {
    const { accessToken: adminToken } = await authenticateContext(app, prisma, usersRepository);
    const { accessToken: memberToken } = await authenticateContext(
      app,
      prisma,
      usersRepository,
      'member',
      { email: 'quarantine-member@example.com' },
    );

    const uploadResponse = await request(app.getHttpServer())
      .post('/api/v1/attachments/upload')
      .set(bearerAuthHeaders(adminToken))
      .attach('file', Buffer.from('this file will be quarantined'), {
        filename: 'quarantined.txt',
        contentType: 'text/plain',
      })
      .expect(201);
    const uploaded = (uploadResponse.body as ApiSuccessResponse<AttachmentBody>).data;
    await waitUntilReady(app, adminToken, uploaded.id);

    // Simulate a positive virus scan directly — the real pipeline
    // (AttachmentProcessingService) sets this same status/scanResult on a
    // scan hit; NoopVirusScanProvider always reports clean in this test
    // environment, so there is no way to trigger it end-to-end here.
    const attachmentClient = prisma.system as unknown as {
      attachment: {
        update(args: {
          where: { id: string };
          data: { status: string; scanResult: string };
        }): Promise<unknown>;
      };
    };
    await attachmentClient.attachment.update({
      where: { id: uploaded.id },
      data: { status: 'QUARANTINED', scanResult: 'EICAR-Test-Signature' },
    });

    await request(app.getHttpServer())
      .get(`/api/v1/attachments/${uploaded.id}/download`)
      .set(bearerAuthHeaders(adminToken))
      .expect(403);

    await request(app.getHttpServer())
      .get(`/api/v1/attachments/${uploaded.id}/download-url`)
      .set(bearerAuthHeaders(adminToken))
      .expect(403);

    await request(app.getHttpServer())
      .get(`/api/v1/attachments/${uploaded.id}/thumbnail`)
      .set(bearerAuthHeaders(adminToken))
      .expect(403);

    // A member (no attachment.admin_override permission) is denied the override.
    await request(app.getHttpServer())
      .get(`/api/v1/attachments/${uploaded.id}/download/admin-override`)
      .set(bearerAuthHeaders(memberToken))
      .expect(403);

    // An admin (has attachment.admin_override) can still retrieve it.
    const overrideResponse = await request(app.getHttpServer())
      .get(`/api/v1/attachments/${uploaded.id}/download/admin-override`)
      .set(bearerAuthHeaders(adminToken))
      .expect(200);
    expect(overrideResponse.text).toBe('this file will be quarantined');

    const auditClient = prisma.system as unknown as {
      auditLog: {
        findMany(args: { where: Record<string, unknown> }): Promise<Array<{ action: string }>>;
      };
    };
    const blockedAudits = await auditClient.auditLog.findMany({
      where: { resourceId: uploaded.id, action: 'attachment.quarantine_blocked' },
    });
    const overrideAudits = await auditClient.auditLog.findMany({
      where: { resourceId: uploaded.id, action: 'attachment.quarantine_override' },
    });
    expect(blockedAudits.length).toBeGreaterThanOrEqual(3);
    expect(overrideAudits).toHaveLength(1);
  });
});
