import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiSuccessResponse } from '../src/common/interceptors/response.interceptor';
import { PrismaService } from '../src/database/prisma.service';
import { TenantContextService } from '../src/common/tenant/tenant-context.service';
import { SeatAssignmentService } from '../src/modules/billing/seat-assignment.service';
import { AuthMeResponseDto, LoginResponseDto } from '../src/modules/auth/dto/auth-response.dto';
import { createTestApp } from './create-test-app';
import { resetAndSeedAuthTestData } from './helpers/users-test.helper';

interface ErrorResponseBody {
  success: false;
  error: { code: string; message: string; details?: unknown };
}

describe('Feature gating — seat quota on invitations (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tenantContextService: TenantContextService;
  let seatAssignmentService: SeatAssignmentService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    tenantContextService = app.get(TenantContextService);
    seatAssignmentService = app.get(SeatAssignmentService);
  });

  beforeEach(async () => {
    await resetAndSeedAuthTestData(prisma);
  });

  afterAll(async () => {
    await resetAndSeedAuthTestData(prisma);
    await app.close();
  });

  function withTenant<T>(organizationId: string, fn: () => Promise<T>): Promise<T> {
    return tenantContextService.run(
      {
        organizationId,
        userId: 'test-user',
        membershipId: 'test-membership',
        requestId: 'test-request',
      },
      fn,
    );
  }

  it('rejects a new invitation once seats are exhausted, and allows one again once a seat is freed', async () => {
    const email = `feature-gating-${Date.now()}@example.com`;

    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email,
        password: 'Password123!',
        firstName: 'Gating',
        lastName: 'Tester',
        organizationName: 'Feature Gating Org',
      })
      .expect(201);
    const accessToken = (registerResponse.body as ApiSuccessResponse<LoginResponseDto>).data
      .accessToken;

    const meResponse = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const organizationId = (meResponse.body as ApiSuccessResponse<AuthMeResponseDto>).data
      .organizationId;

    const ownerMembership = await prisma.system.membership.findFirstOrThrow({
      where: { organizationId },
    });
    const memberRole = await prisma.system.role.findUniqueOrThrow({ where: { key: 'member' } });

    // The trial subscription created at registration has exactly 1 seat —
    // consume it (the owner's own seat) so the org is now at capacity.
    await withTenant(organizationId, () =>
      seatAssignmentService.assignSeat(organizationId, ownerMembership.id),
    );

    const exhaustedResponse = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationId}/invitations`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ email: 'invitee@example.com', roleId: memberRole.id })
      .expect(403);
    const errorBody = exhaustedResponse.body as ErrorResponseBody;
    expect(errorBody.error.code).toBe('QUOTA_EXCEEDED');
    expect(errorBody.error.details).toEqual(
      expect.objectContaining({ featureKey: 'seats', limit: 1, currentUsage: 1 }),
    );

    await withTenant(organizationId, () => seatAssignmentService.releaseSeat(ownerMembership.id));

    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationId}/invitations`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ email: 'invitee@example.com', roleId: memberRole.id })
      .expect(201);
  });
});

describe('Feature gating — RBAC on billing endpoints (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await resetAndSeedAuthTestData(prisma);
  });

  afterAll(async () => {
    await resetAndSeedAuthTestData(prisma);
    await app.close();
  });

  function extractInvitationToken(link: string): string {
    return new URL(link.replace('voltx://', 'https://placeholder/')).searchParams.get('token')!;
  }

  it('lets a member read billing.subscription.read but blocks billing.subscription.manage actions', async () => {
    const ownerEmail = `billing-rbac-owner-${Date.now()}@example.com`;
    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: ownerEmail,
        password: 'Password123!',
        firstName: 'Owner',
        lastName: 'Tester',
        organizationName: 'Billing RBAC Org',
      })
      .expect(201);
    const ownerAccessToken = (registerResponse.body as ApiSuccessResponse<LoginResponseDto>).data
      .accessToken;
    const meResponse = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .expect(200);
    const organizationId = (meResponse.body as ApiSuccessResponse<AuthMeResponseDto>).data
      .organizationId;
    const memberRole = await prisma.system.role.findUniqueOrThrow({ where: { key: 'member' } });

    const memberEmail = `billing-rbac-member-${Date.now()}@example.com`;
    const inviteResponse = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationId}/invitations`)
      .set('Authorization', `Bearer ${ownerAccessToken}`)
      .send({ email: memberEmail, roleId: memberRole.id })
      .expect(201);
    const invitation = (inviteResponse.body as ApiSuccessResponse<{ invitationLink: string }>).data;
    const token = extractInvitationToken(invitation.invitationLink);

    const acceptResponse = await request(app.getHttpServer())
      .post(`/api/v1/invitations/${token}/accept`)
      .send({ password: 'Password123!', firstName: 'Member', lastName: 'Tester' })
      .expect(201);
    const memberAccessToken = (
      acceptResponse.body as ApiSuccessResponse<{ session: { accessToken: string } }>
    ).data.session.accessToken;

    // member role was seeded with billing.subscription.read only.
    await request(app.getHttpServer())
      .get('/api/v1/billing/subscription')
      .set('Authorization', `Bearer ${memberAccessToken}`)
      .expect(200);

    // ...but not billing.subscription.manage — every mutating subscription
    // endpoint stays behind PermissionGuard regardless of quota/feature-gate status.
    await request(app.getHttpServer())
      .post('/api/v1/billing/checkout')
      .set('Authorization', `Bearer ${memberAccessToken}`)
      .send({
        planKey: 'business',
        seats: 1,
        successUrl: 'https://app.voltx.io/billing?checkout=success',
        cancelUrl: 'https://app.voltx.io/billing/upgrade?checkout=cancelled',
      })
      .expect(403);

    await request(app.getHttpServer())
      .post('/api/v1/billing/subscription/cancel')
      .set('Authorization', `Bearer ${memberAccessToken}`)
      .send({ atPeriodEnd: true })
      .expect(403);
  });
});
