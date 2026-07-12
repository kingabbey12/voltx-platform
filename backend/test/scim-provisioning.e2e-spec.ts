import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiSuccessResponse } from '../src/common/interceptors/response.interceptor';
import { PrismaService } from '../src/database/prisma.service';
import { UsersRepository } from '../src/modules/users/users.repository';
import { createTestApp } from './create-test-app';
import { authenticateContext, resetAndSeedAuthTestData } from './helpers/users-test.helper';

interface CreateScimTokenResponse {
  id: string;
  token: string;
}

interface ScimUserResource {
  id: string;
  userName: string;
  active: boolean;
}

interface ScimListResponse<T> {
  totalResults: number;
  Resources: T[];
}

describe('SCIM 2.0 provisioning (e2e)', () => {
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

  async function issueScimToken(accessToken: string, organizationId: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationId}/identity/scim-tokens`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Test SCIM token' })
      .expect(201);
    return (response.body as ApiSuccessResponse<CreateScimTokenResponse>).data.token;
  }

  it('provisions a brand-new user via SCIM Users POST', async () => {
    const owner = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `scim-owner-${Date.now()}@example.com`,
    });
    const scimToken = await issueScimToken(owner.accessToken, owner.organization.id);
    const scimEmail = `scim-provisioned-${Date.now()}@example.com`;

    const response = await request(app.getHttpServer())
      .post('/api/v1/scim/v2/Users')
      .set('Authorization', `Bearer ${scimToken}`)
      .send({
        schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
        userName: scimEmail,
        name: { givenName: 'Scim', familyName: 'Provisioned' },
        active: true,
      })
      .expect(201);

    const created = response.body as ScimUserResource;
    expect(created.userName).toBe(scimEmail);
    expect(created.active).toBe(true);

    const membership = await prisma.system.membership.findFirst({
      where: { organizationId: owner.organization.id, user: { email: scimEmail } },
    });
    expect(membership).not.toBeNull();
  });

  it('deactivates a user via SCIM PATCH active:false and revokes their sessions', async () => {
    const owner = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `scim-deactivate-owner-${Date.now()}@example.com`,
    });
    const scimToken = await issueScimToken(owner.accessToken, owner.organization.id);
    const scimEmail = `scim-to-deactivate-${Date.now()}@example.com`;

    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/scim/v2/Users')
      .set('Authorization', `Bearer ${scimToken}`)
      .send({ userName: scimEmail, active: true })
      .expect(201);
    const created = createResponse.body as ScimUserResource;

    // Simulate a live session for the SCIM-provisioned user, to prove it
    // gets revoked by the deactivation below.
    await prisma.system.refreshToken.create({
      data: {
        userId: created.id,
        tokenHash: 'fake-hash-for-e2e',
        expiresAt: new Date(Date.now() + 60000),
      },
    });

    await request(app.getHttpServer())
      .patch(`/api/v1/scim/v2/Users/${created.id}`)
      .set('Authorization', `Bearer ${scimToken}`)
      .send({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
        Operations: [{ op: 'replace', path: 'active', value: false }],
      })
      .expect(200);

    const membership = await prisma.system.membership.findFirst({
      where: { organizationId: owner.organization.id, userId: created.id },
    });
    expect(membership?.status).toBe('INACTIVE');

    const remainingTokens = await prisma.system.refreshToken.count({
      where: { userId: created.id, revokedAt: null },
    });
    expect(remainingTokens).toBe(0);
  });

  it("never lets organization A's SCIM token see or provision users into organization B", async () => {
    const ownerA = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `scim-org-a-${Date.now()}@example.com`,
    });
    const ownerB = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `scim-org-b-${Date.now()}@example.com`,
    });
    const scimTokenForOrgA = await issueScimToken(ownerA.accessToken, ownerA.organization.id);

    // Provision a user into org B directly (not via SCIM) to prove org A's token can't see it.
    const orgBUserEmail = `org-b-user-${Date.now()}@example.com`;
    const orgBUser = await usersRepository.create({
      email: orgBUserEmail,
      firstName: 'Org B',
      lastName: 'User',
    });
    const memberRole = await prisma.system.role.findUniqueOrThrow({ where: { key: 'member' } });
    await prisma.system.membership.create({
      data: {
        organizationId: ownerB.organization.id,
        userId: orgBUser.id,
        roleId: memberRole.id,
        status: 'ACTIVE',
      },
    });

    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/scim/v2/Users')
      .set('Authorization', `Bearer ${scimTokenForOrgA}`)
      .query({ filter: `userName eq "${orgBUserEmail}"` })
      .expect(200);
    const list = listResponse.body as ScimListResponse<ScimUserResource>;
    expect(list.totalResults).toBe(0);

    await request(app.getHttpServer())
      .get(`/api/v1/scim/v2/Users/${orgBUser.id}`)
      .set('Authorization', `Bearer ${scimTokenForOrgA}`)
      .expect(404);
  });

  it('rejects SCIM requests with no bearer token', async () => {
    await request(app.getHttpServer()).get('/api/v1/scim/v2/Users').expect(401);
  });

  it('rejects SCIM requests using a revoked token', async () => {
    const owner = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `scim-revoke-${Date.now()}@example.com`,
    });
    const tokenCreateResponse = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${owner.organization.id}/identity/scim-tokens`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Token to revoke' })
      .expect(201);
    const created = (tokenCreateResponse.body as ApiSuccessResponse<CreateScimTokenResponse>).data;

    await request(app.getHttpServer())
      .delete(`/api/v1/organizations/${owner.organization.id}/identity/scim-tokens/${created.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);

    await request(app.getHttpServer())
      .get('/api/v1/scim/v2/Users')
      .set('Authorization', `Bearer ${created.token}`)
      .expect(401);
  });

  it('rejects an unsupported SCIM filter expression with a 400, not a silent ignore', async () => {
    const owner = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `scim-filter-${Date.now()}@example.com`,
    });
    const scimToken = await issueScimToken(owner.accessToken, owner.organization.id);

    await request(app.getHttpServer())
      .get('/api/v1/scim/v2/Users')
      .set('Authorization', `Bearer ${scimToken}`)
      .query({ filter: 'userName co "example"' })
      .expect(400);
  });

  it('projects roles as SCIM groups and reassigns a role via Group PATCH', async () => {
    const owner = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `scim-group-owner-${Date.now()}@example.com`,
    });
    const scimToken = await issueScimToken(owner.accessToken, owner.organization.id);
    const scimEmail = `scim-group-member-${Date.now()}@example.com`;

    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/scim/v2/Users')
      .set('Authorization', `Bearer ${scimToken}`)
      .send({ userName: scimEmail, active: true })
      .expect(201);
    const created = createResponse.body as ScimUserResource;

    const adminRole = await prisma.system.role.findUniqueOrThrow({ where: { key: 'admin' } });

    await request(app.getHttpServer())
      .patch(`/api/v1/scim/v2/Groups/${adminRole.id}`)
      .set('Authorization', `Bearer ${scimToken}`)
      .send({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:PatchOp'],
        Operations: [{ op: 'add', path: 'members', value: [{ value: created.id }] }],
      })
      .expect(200);

    const membership = await prisma.system.membership.findFirst({
      where: { organizationId: owner.organization.id, userId: created.id },
    });
    expect(membership?.roleId).toBe(adminRole.id);
  });
});
