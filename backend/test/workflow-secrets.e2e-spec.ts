import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiSuccessResponse } from '../src/common/interceptors/response.interceptor';
import { PrismaService } from '../src/database/prisma.service';
import { UsersRepository } from '../src/modules/users/users.repository';
import { WorkflowSecretService } from '../src/modules/workflows/workflow-secret.service';
import { TenantContextService } from '../src/common/tenant/tenant-context.service';
import { createTestApp } from './create-test-app';
import {
  authenticateContext,
  bearerAuthHeaders,
  resetAndSeedAuthTestData,
} from './helpers/users-test.helper';

interface SecretBody {
  id: string;
  key: string;
  lastRotatedAt: string | null;
}

describe('Workflow Secrets (e2e)', () => {
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

  it('creates a secret, never returns its value, and lists it as metadata only', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);
    const key = `STRIPE_API_KEY_${Date.now()}`;

    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/workflows/secrets')
      .set(bearerAuthHeaders(accessToken))
      .send({ key, value: 'sk_live_super_secret_value', description: 'For invoicing' })
      .expect(201);
    const created = createResponse.body as ApiSuccessResponse<Record<string, unknown>>;
    expect(created.data.key).toBe(key);
    expect(created.data).not.toHaveProperty('value');
    expect(created.data).not.toHaveProperty('encryptedValue');
    expect(JSON.stringify(created.data)).not.toContain('sk_live_super_secret_value');

    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/workflows/secrets')
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    const listed = (listResponse.body as ApiSuccessResponse<SecretBody[]>).data;
    expect(listed.some((item) => item.key === key)).toBe(true);
    expect(JSON.stringify(listResponse.body)).not.toContain('sk_live_super_secret_value');
  });

  it('rejects creating a duplicate secret key for the same org', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);
    const key = `DUPLICATE_KEY_${Date.now()}`;

    await request(app.getHttpServer())
      .post('/api/v1/workflows/secrets')
      .set(bearerAuthHeaders(accessToken))
      .send({ key, value: 'first-value' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/workflows/secrets')
      .set(bearerAuthHeaders(accessToken))
      .send({ key, value: 'second-value' })
      .expect(409);
  });

  it('rotates a secret’s value and the new value round-trips through decryption', async () => {
    const { accessToken, organization } = await authenticateContext(app, prisma, usersRepository);
    const key = `ROTATE_KEY_${Date.now()}`;

    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/workflows/secrets')
      .set(bearerAuthHeaders(accessToken))
      .send({ key, value: 'original-value' })
      .expect(201);
    const created = (createResponse.body as ApiSuccessResponse<SecretBody>).data;
    expect(created.lastRotatedAt).toBeNull();

    const rotateResponse = await request(app.getHttpServer())
      .post(`/api/v1/workflows/secrets/${created.id}/rotate`)
      .set(bearerAuthHeaders(accessToken))
      .send({ value: 'rotated-value' })
      .expect(201);
    const rotated = (rotateResponse.body as ApiSuccessResponse<SecretBody>).data;
    expect(rotated.lastRotatedAt).not.toBeNull();

    const workflowSecretService = app.get(WorkflowSecretService);
    const tenantContextService = app.get(TenantContextService);
    const decrypted = await tenantContextService.run(
      {
        organizationId: organization.id,
        userId: 'test-user',
        membershipId: 'test-membership',
        requestId: 'test-request',
      },
      () => workflowSecretService.resolveDecryptedValue(key),
    );
    expect(decrypted).toBe('rotated-value');
  });

  it('deletes a secret', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository);
    const key = `DELETE_KEY_${Date.now()}`;

    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/workflows/secrets')
      .set(bearerAuthHeaders(accessToken))
      .send({ key, value: 'value' })
      .expect(201);
    const created = (createResponse.body as ApiSuccessResponse<SecretBody>).data;

    await request(app.getHttpServer())
      .delete(`/api/v1/workflows/secrets/${created.id}`)
      .set(bearerAuthHeaders(accessToken))
      .expect(200);

    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/workflows/secrets')
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    const listed = (listResponse.body as ApiSuccessResponse<SecretBody[]>).data;
    expect(listed.some((item) => item.id === created.id)).toBe(false);
  });

  it('denies a viewer from creating a secret', async () => {
    const { accessToken } = await authenticateContext(app, prisma, usersRepository, 'viewer');

    await request(app.getHttpServer())
      .post('/api/v1/workflows/secrets')
      .set(bearerAuthHeaders(accessToken))
      .send({ key: `viewer-secret-${Date.now()}`, value: 'value' })
      .expect(403);
  });

  it('never leaks another organization’s secret list', async () => {
    const orgA = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: 'workflow-secrets-org-a@example.com',
    });
    const orgB = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: 'workflow-secrets-org-b@example.com',
    });
    const key = `ORG_A_SECRET_${Date.now()}`;

    await request(app.getHttpServer())
      .post('/api/v1/workflows/secrets')
      .set(bearerAuthHeaders(orgA.accessToken))
      .send({ key, value: 'org-a-value' })
      .expect(201);

    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/workflows/secrets')
      .set(bearerAuthHeaders(orgB.accessToken))
      .expect(200);
    const listed = (listResponse.body as ApiSuccessResponse<SecretBody[]>).data;
    expect(listed.some((item) => item.key === key)).toBe(false);
  });
});
