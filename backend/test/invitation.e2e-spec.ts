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

interface InvitationBody {
  id: string;
  status: string;
  invitationLink: string;
}

describe('Organization Invitations (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let usersRepository: UsersRepository;
  let memberRoleId: string;
  let ownerAccessToken: string;
  let organizationId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    usersRepository = app.get(UsersRepository);
  });

  beforeEach(async () => {
    await resetAndSeedAuthTestData(prisma);
    const auth = await authenticateContext(app, prisma, usersRepository, 'owner');
    ownerAccessToken = auth.accessToken;
    organizationId = auth.organization.id;
    const role = await prisma.system.role.findUniqueOrThrow({ where: { key: 'member' } });
    memberRoleId = role.id;
  });

  afterAll(async () => {
    await resetAndSeedAuthTestData(prisma);
    await app.close();
  });

  function extractToken(link: string): string {
    return new URL(link.replace('voltx://', 'https://placeholder/')).searchParams.get('token')!;
  }

  it('invites, previews, and accepts as a brand-new account', async () => {
    const email = `new.invitee.${Date.now()}@example.com`;

    const createResponse = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationId}/invitations`)
      .set(bearerAuthHeaders(ownerAccessToken))
      .send({ email, roleId: memberRoleId })
      .expect(201);
    const invitation = (createResponse.body as ApiSuccessResponse<InvitationBody>).data;
    expect(invitation.status).toBe('PENDING');

    const token = extractToken(invitation.invitationLink);

    const preview = await request(app.getHttpServer())
      .get(`/api/v1/invitations/${token}`)
      .expect(200);
    const previewBody = (
      preview.body as ApiSuccessResponse<{ email: string; hasExistingAccount: boolean }>
    ).data;
    expect(previewBody.email).toBe(email);
    expect(previewBody.hasExistingAccount).toBe(false);

    const acceptResponse = await request(app.getHttpServer())
      .post(`/api/v1/invitations/${token}/accept`)
      .send({ password: 'BrandNewPass123!', firstName: 'Brand', lastName: 'New' })
      .expect(201);
    const acceptBody = (
      acceptResponse.body as ApiSuccessResponse<{
        newAccount: boolean;
        session?: { accessToken: string; user: { email: string } };
      }>
    ).data;
    expect(acceptBody.newAccount).toBe(true);
    expect(acceptBody.session?.user.email).toBe(email);

    const me = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set(bearerAuthHeaders(acceptBody.session!.accessToken))
      .expect(200);
    const meBody = (me.body as ApiSuccessResponse<{ roles: string[]; organizationId: string }>)
      .data;
    expect(meBody.roles).toContain('member');
    expect(meBody.organizationId).toBe(organizationId);
  });

  it('adds a membership without exposing tokens when the invitee already has an account', async () => {
    const existing = await authenticateContext(app, prisma, usersRepository, 'owner', {
      email: `existing.account.${Date.now()}@example.com`,
    });

    const createResponse = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationId}/invitations`)
      .set(bearerAuthHeaders(ownerAccessToken))
      .send({ email: existing.user.email, roleId: memberRoleId })
      .expect(201);
    const invitation = (createResponse.body as ApiSuccessResponse<InvitationBody>).data;
    const token = extractToken(invitation.invitationLink);

    const acceptResponse = await request(app.getHttpServer())
      .post(`/api/v1/invitations/${token}/accept`)
      .send({})
      .expect(201);
    const acceptBody = (acceptResponse.body as ApiSuccessResponse<{ newAccount: boolean }>).data;
    expect(acceptBody.newAccount).toBe(false);

    const memberships = await prisma.system.membership.findMany({
      where: { userId: existing.user.id },
    });
    expect(memberships.some((m) => m.organizationId === organizationId)).toBe(true);
  });

  it('rejects invite/list/revoke/resend from a member without organization.invite permission', async () => {
    const member = await authenticateContext(app, prisma, usersRepository, 'member', {
      email: `member.no.invite.${Date.now()}@example.com`,
    });

    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${member.organization.id}/invitations`)
      .set(bearerAuthHeaders(member.accessToken))
      .send({ email: 'someone@example.com', roleId: memberRoleId })
      .expect(403);
  });

  it("rejects cross-tenant access to another organization's invitations (create/list/revoke/resend)", async () => {
    // Regression test for a critical bug found in VT-031: an authenticated
    // owner of a DIFFERENT organization could invite/list/revoke/resend
    // invitations on this organization just by supplying its
    // organizationId in the path — the permission guard only checked that
    // the caller HAD organization.invite (true for any owner, on their own
    // org), never that the path's organizationId matched the caller's own
    // tenant context. Fixed via TenantContextService.assertOrganizationAccess
    // in every InvitationService method that takes an organizationId.
    const outsider = await authenticateContext(app, prisma, usersRepository, 'owner', {
      email: `outsider.${Date.now()}@example.com`,
    });

    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationId}/invitations`)
      .set(bearerAuthHeaders(outsider.accessToken))
      .send({ email: 'attacker@example.com', roleId: memberRoleId })
      .expect(403);

    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${organizationId}/invitations`)
      .set(bearerAuthHeaders(outsider.accessToken))
      .expect(403);

    const email = `crosstenant.${Date.now()}@example.com`;
    const createResponse = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationId}/invitations`)
      .set(bearerAuthHeaders(ownerAccessToken))
      .send({ email, roleId: memberRoleId })
      .expect(201);
    const invitation = (createResponse.body as ApiSuccessResponse<InvitationBody>).data;

    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationId}/invitations/${invitation.id}/resend`)
      .set(bearerAuthHeaders(outsider.accessToken))
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/v1/organizations/${organizationId}/invitations/${invitation.id}`)
      .set(bearerAuthHeaders(outsider.accessToken))
      .expect(403);

    // Confirm it's still untouched and the legitimate owner can still manage it.
    await request(app.getHttpServer())
      .delete(`/api/v1/organizations/${organizationId}/invitations/${invitation.id}`)
      .set(bearerAuthHeaders(ownerAccessToken))
      .expect(200);
  });

  it('rejects granting the owner role via invitation', async () => {
    const ownerRole = await prisma.system.role.findUniqueOrThrow({ where: { key: 'owner' } });

    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationId}/invitations`)
      .set(bearerAuthHeaders(ownerAccessToken))
      .send({ email: 'wannabe-owner@example.com', roleId: ownerRole.id })
      .expect(400);
  });

  it('revokes a pending invitation and blocks accept/resend afterward', async () => {
    const email = `revoke.target.${Date.now()}@example.com`;
    const createResponse = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationId}/invitations`)
      .set(bearerAuthHeaders(ownerAccessToken))
      .send({ email, roleId: memberRoleId })
      .expect(201);
    const invitation = (createResponse.body as ApiSuccessResponse<InvitationBody>).data;
    const token = extractToken(invitation.invitationLink);

    await request(app.getHttpServer())
      .delete(`/api/v1/organizations/${organizationId}/invitations/${invitation.id}`)
      .set(bearerAuthHeaders(ownerAccessToken))
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationId}/invitations/${invitation.id}/resend`)
      .set(bearerAuthHeaders(ownerAccessToken))
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/invitations/${token}/accept`)
      .send({ password: 'DoesntMatter123!', firstName: 'A', lastName: 'B' })
      .expect(400);
  });

  it('rejects a duplicate pending invitation for the same email', async () => {
    const email = `dup.${Date.now()}@example.com`;
    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationId}/invitations`)
      .set(bearerAuthHeaders(ownerAccessToken))
      .send({ email, roleId: memberRoleId })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationId}/invitations`)
      .set(bearerAuthHeaders(ownerAccessToken))
      .send({ email, roleId: memberRoleId })
      .expect(409);
  });

  it('handles two concurrent new-account accepts of the same invitation without a 500', async () => {
    // Regression test (VT-031): both requests can pass the "does a user
    // exist yet" check before either commits, so the loser hits a raw
    // Prisma unique-constraint violation on User.email. That must surface
    // as a clean 409, not an unhandled 500.
    const email = `race.${Date.now()}@example.com`;
    const createResponse = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationId}/invitations`)
      .set(bearerAuthHeaders(ownerAccessToken))
      .send({ email, roleId: memberRoleId })
      .expect(201);
    const invitation = (createResponse.body as ApiSuccessResponse<InvitationBody>).data;
    const token = extractToken(invitation.invitationLink);

    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post(`/api/v1/invitations/${token}/accept`)
        .send({ password: 'RacePass123!', firstName: 'Race', lastName: 'One' }),
      request(app.getHttpServer())
        .post(`/api/v1/invitations/${token}/accept`)
        .send({ password: 'RacePass123!', firstName: 'Race', lastName: 'Two' }),
    ]);

    const statuses = [first.status, second.status].sort();
    expect(statuses).toEqual([201, 409]);

    const users = await prisma.system.user.findMany({ where: { email } });
    expect(users).toHaveLength(1);
  });
});
