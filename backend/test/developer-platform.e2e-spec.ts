import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiSuccessResponse } from '../src/common/interceptors/response.interceptor';
import { PrismaService } from '../src/database/prisma.service';
import { UsersRepository } from '../src/modules/users/users.repository';
import { createTestApp } from './create-test-app';
import { authenticateContext, resetAndSeedAuthTestData } from './helpers/users-test.helper';

interface CreatePersonalAccessTokenResponse {
  id: string;
  token: string;
}

interface WhoamiResponse {
  organizationId: string;
  permissions: string[];
}

interface RoleListResponse {
  items: { id: string; key: string }[];
}

interface CreateServiceAccountTokenResponse {
  id: string;
  token: string;
}

async function getRoleId(
  app: INestApplication<App>,
  accessToken: string,
  roleKey: string,
): Promise<string> {
  const response = await request(app.getHttpServer())
    .get('/api/v1/roles')
    .set('Authorization', `Bearer ${accessToken}`)
    .expect(200);
  const roles = (response.body as ApiSuccessResponse<RoleListResponse>).data.items;
  const role = roles.find((r) => r.key === roleKey);
  if (!role) throw new Error(`Role "${roleKey}" not found in test fixture`);
  return role.id;
}

describe('Developer Platform — Personal Access Tokens & Service Accounts (e2e)', () => {
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

  describe('Personal Access Tokens', () => {
    it('runs the full lifecycle: create, authenticate with it, revoke, confirm 401', async () => {
      const owner = await authenticateContext(app, prisma, usersRepository, 'admin', {
        email: `pat-lifecycle-${Date.now()}@example.com`,
      });
      const auth = { Authorization: `Bearer ${owner.accessToken}` };

      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/developer/personal-access-tokens')
        .set(auth)
        .send({ name: 'CI script', scopedPermissions: ['organization.read'] })
        .expect(201);
      const created = (createResponse.body as ApiSuccessResponse<CreatePersonalAccessTokenResponse>)
        .data;
      expect(created.token).toMatch(/^vpat_/);

      const whoamiResponse = await request(app.getHttpServer())
        .get('/api/v1/developer/personal-access-tokens/whoami')
        .set('X-Personal-Access-Token', created.token)
        .set('X-Organization-Id', owner.organization.id)
        .expect(200);
      const whoami = (whoamiResponse.body as ApiSuccessResponse<WhoamiResponse>).data;
      expect(whoami.organizationId).toBe(owner.organization.id);
      expect(whoami.permissions).toEqual(['organization.read']);

      await request(app.getHttpServer())
        .delete(`/api/v1/developer/personal-access-tokens/${created.id}`)
        .set(auth)
        .expect(200);

      await request(app.getHttpServer())
        .get('/api/v1/developer/personal-access-tokens/whoami')
        .set('X-Personal-Access-Token', created.token)
        .set('X-Organization-Id', owner.organization.id)
        .expect(401);
    });

    it('rejects using a token against an organization the owner is not a member of', async () => {
      const owner = await authenticateContext(app, prisma, usersRepository, 'admin', {
        email: `pat-cross-org-owner-${Date.now()}@example.com`,
      });
      const otherOrg = await authenticateContext(app, prisma, usersRepository, 'admin', {
        email: `pat-cross-org-other-${Date.now()}@example.com`,
      });

      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/developer/personal-access-tokens')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ name: 'CI script', scopedPermissions: ['organization.read'] })
        .expect(201);
      const created = (createResponse.body as ApiSuccessResponse<CreatePersonalAccessTokenResponse>)
        .data;

      await request(app.getHttpServer())
        .get('/api/v1/developer/personal-access-tokens/whoami')
        .set('X-Personal-Access-Token', created.token)
        .set('X-Organization-Id', otherOrg.organization.id)
        .expect(403);
    });

    it('requires the X-Organization-Id header even for a valid token', async () => {
      const owner = await authenticateContext(app, prisma, usersRepository, 'admin', {
        email: `pat-missing-org-header-${Date.now()}@example.com`,
      });
      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/developer/personal-access-tokens')
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({ name: 'CI script', scopedPermissions: ['organization.read'] })
        .expect(201);
      const created = (createResponse.body as ApiSuccessResponse<CreatePersonalAccessTokenResponse>)
        .data;

      await request(app.getHttpServer())
        .get('/api/v1/developer/personal-access-tokens/whoami')
        .set('X-Personal-Access-Token', created.token)
        .expect(400);
    });
  });

  describe('Service Accounts', () => {
    it('runs the full lifecycle: create, issue token, authenticate, suspend, reactivate, revoke', async () => {
      const admin = await authenticateContext(app, prisma, usersRepository, 'admin', {
        email: `sa-lifecycle-${Date.now()}@example.com`,
      });
      const auth = { Authorization: `Bearer ${admin.accessToken}` };
      const memberRoleId = await getRoleId(app, admin.accessToken, 'member');

      const createResponse = await request(app.getHttpServer())
        .post(`/api/v1/organizations/${admin.organization.id}/service-accounts`)
        .set(auth)
        .send({ name: 'CI Pipeline', roleId: memberRoleId })
        .expect(201);
      const serviceAccount = (createResponse.body as ApiSuccessResponse<{ id: string }>).data;

      const tokenResponse = await request(app.getHttpServer())
        .post(
          `/api/v1/organizations/${admin.organization.id}/service-accounts/${serviceAccount.id}/tokens`,
        )
        .set(auth)
        .send({ name: 'Production token' })
        .expect(201);
      const token = (tokenResponse.body as ApiSuccessResponse<CreateServiceAccountTokenResponse>)
        .data;
      expect(token.token).toMatch(/^vsa_/);

      const whoamiResponse = await request(app.getHttpServer())
        .get('/api/v1/developer/service-accounts/whoami')
        .set('X-Service-Account-Token', token.token)
        .expect(200);
      const whoami = (whoamiResponse.body as ApiSuccessResponse<WhoamiResponse>).data;
      expect(whoami.organizationId).toBe(admin.organization.id);
      expect(whoami.permissions).toContain('organization.read');

      await request(app.getHttpServer())
        .post(
          `/api/v1/organizations/${admin.organization.id}/service-accounts/${serviceAccount.id}/suspend`,
        )
        .set(auth)
        .expect(200);

      await request(app.getHttpServer())
        .get('/api/v1/developer/service-accounts/whoami')
        .set('X-Service-Account-Token', token.token)
        .expect(401);

      await request(app.getHttpServer())
        .post(
          `/api/v1/organizations/${admin.organization.id}/service-accounts/${serviceAccount.id}/reactivate`,
        )
        .set(auth)
        .expect(200);

      await request(app.getHttpServer())
        .get('/api/v1/developer/service-accounts/whoami')
        .set('X-Service-Account-Token', token.token)
        .expect(200);

      await request(app.getHttpServer())
        .delete(
          `/api/v1/organizations/${admin.organization.id}/service-accounts/${serviceAccount.id}/tokens/${token.id}`,
        )
        .set(auth)
        .expect(200);

      await request(app.getHttpServer())
        .get('/api/v1/developer/service-accounts/whoami')
        .set('X-Service-Account-Token', token.token)
        .expect(401);
    });

    it('rejects granting a service account a role with more permissions than the caller holds', async () => {
      const manager = await authenticateContext(app, prisma, usersRepository, 'manager', {
        email: `sa-escalation-${Date.now()}@example.com`,
      });
      const ownerRoleId = await getRoleId(app, manager.accessToken, 'owner');

      await request(app.getHttpServer())
        .post(`/api/v1/organizations/${manager.organization.id}/service-accounts`)
        .set('Authorization', `Bearer ${manager.accessToken}`)
        .send({ name: 'Escalation attempt', roleId: ownerRoleId })
        .expect(403);
    });

    it('never lets a service account created in one organization be listed from another', async () => {
      const orgA = await authenticateContext(app, prisma, usersRepository, 'admin', {
        email: `sa-isolation-a-${Date.now()}@example.com`,
      });
      const orgB = await authenticateContext(app, prisma, usersRepository, 'admin', {
        email: `sa-isolation-b-${Date.now()}@example.com`,
      });
      const memberRoleId = await getRoleId(app, orgA.accessToken, 'member');

      await request(app.getHttpServer())
        .post(`/api/v1/organizations/${orgA.organization.id}/service-accounts`)
        .set('Authorization', `Bearer ${orgA.accessToken}`)
        .send({ name: 'Org A service account', roleId: memberRoleId })
        .expect(201);

      const listAsB = await request(app.getHttpServer())
        .get(`/api/v1/organizations/${orgB.organization.id}/service-accounts`)
        .set('Authorization', `Bearer ${orgB.accessToken}`)
        .expect(200);
      expect((listAsB.body as ApiSuccessResponse<unknown[]>).data).toEqual([]);

      // Directly attempting to read org A's service accounts using org B's
      // own token must be rejected outright by
      // ServiceAccountService's assertOrganizationAccess() (the route
      // param never matches org B's JWT-derived tenant context), not just
      // return an empty list.
      await request(app.getHttpServer())
        .get(`/api/v1/organizations/${orgA.organization.id}/service-accounts`)
        .set('Authorization', `Bearer ${orgB.accessToken}`)
        .expect(403);
    });
  });
});
