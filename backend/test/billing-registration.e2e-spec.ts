import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiSuccessResponse } from '../src/common/interceptors/response.interceptor';
import { PrismaService } from '../src/database/prisma.service';
import { TenantContextService } from '../src/common/tenant/tenant-context.service';
import { BillingAccountService } from '../src/modules/billing/billing-account.service';
import { SubscriptionService } from '../src/modules/billing/subscription.service';
import { SeatAssignmentService } from '../src/modules/billing/seat-assignment.service';
import { AuthMeResponseDto, LoginResponseDto } from '../src/modules/auth/dto/auth-response.dto';
import { createTestApp } from './create-test-app';
import { resetAndSeedAuthTestData } from './helpers/users-test.helper';

describe('Billing on registration (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tenantContextService: TenantContextService;
  let billingAccountService: BillingAccountService;
  let subscriptionService: SubscriptionService;
  let seatAssignmentService: SeatAssignmentService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    tenantContextService = app.get(TenantContextService);
    billingAccountService = app.get(BillingAccountService);
    subscriptionService = app.get(SubscriptionService);
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

  it('creates a real BillingAccount and a trialing Professional subscription for a new organization', async () => {
    const email = `billing-registration-${Date.now()}@example.com`;

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email,
        password: 'Password123!',
        firstName: 'Billing',
        lastName: 'Tester',
        organizationName: 'Billing Registration Org',
      })
      .expect(201);

    const body = (response.body as ApiSuccessResponse<LoginResponseDto>).data;
    expect(body.user.email).toBe(email);

    const meResponse = await request(app.getHttpServer())
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${body.accessToken}`)
      .expect(200);
    const organizationId = (meResponse.body as ApiSuccessResponse<AuthMeResponseDto>).data
      .organizationId;

    const billingAccount = await withTenant(organizationId, () =>
      billingAccountService.getForCurrentOrganizationOrThrow(),
    );
    expect(billingAccount.organizationId).toBe(organizationId);
    // Real, genuinely-null column — not a fabricated placeholder value —
    // until Phase 2's StripeCustomerService talks to Stripe for real.
    expect(billingAccount.stripeCustomerId).toBeNull();

    const subscription = await subscriptionService.getCurrentForOrganizationOrThrow(organizationId);
    expect(subscription.status).toBe('TRIALING');
    expect(subscription.billingAccountId).toBe(billingAccount.id);
    expect(subscription.seats).toBe(1);
    expect(subscription.trialStart).not.toBeNull();
    expect(subscription.trialEnd).not.toBeNull();
    const trialDurationMs = subscription.trialEnd!.getTime() - subscription.trialStart!.getTime();
    expect(trialDurationMs).toBe(14 * 24 * 60 * 60 * 1000);

    const plan = await prisma.system.plan.findUnique({ where: { id: subscription.planId } });
    expect(plan?.key).toBe('professional');
  });

  it('reports zeroed current-period usage against the Professional plan limits right after registration', async () => {
    const email = `billing-usage-${Date.now()}@example.com`;

    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email,
        password: 'Password123!',
        firstName: 'Usage',
        lastName: 'Tester',
        organizationName: 'Usage Test Org',
      })
      .expect(201);
    const accessToken = (registerResponse.body as ApiSuccessResponse<LoginResponseDto>).data
      .accessToken;

    const usageResponse = await request(app.getHttpServer())
      .get('/api/v1/billing/usage')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const usage = (
      usageResponse.body as ApiSuccessResponse<
        Array<{ featureKey: string; currentUsage: number; limit: number | null }>
      >
    ).data;

    expect(usage.length).toBeGreaterThan(0);
    const aiRequestsUsage = usage.find((entry) => entry.featureKey === 'ai_requests');
    expect(aiRequestsUsage).toBeDefined();
    expect(aiRequestsUsage?.currentUsage).toBe(0);
    expect(typeof aiRequestsUsage?.limit === 'number' || aiRequestsUsage?.limit === null).toBe(
      true,
    );

    const historyResponse = await request(app.getHttpServer())
      .get('/api/v1/billing/usage/history')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    const history = (historyResponse.body as ApiSuccessResponse<unknown[]>).data;
    expect(history).toEqual([]);
  });

  it('assigns and releases seats against the org’s subscription, respecting availability', async () => {
    const email = `billing-seats-${Date.now()}@example.com`;
    const registerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email,
        password: 'Password123!',
        firstName: 'Seat',
        lastName: 'Tester',
        organizationName: 'Seat Test Org',
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

    const membership = await prisma.system.membership.findFirstOrThrow({
      where: { organizationId },
    });

    const availabilityBefore = await withTenant(organizationId, () =>
      seatAssignmentService.getAvailability(organizationId),
    );
    expect(availabilityBefore).toEqual({ used: 0, limit: 1, available: 1, hasCapacity: true });

    const assigned = await withTenant(organizationId, () =>
      seatAssignmentService.assignSeat(organizationId, membership.id),
    );
    expect(assigned.membershipId).toBe(membership.id);

    const availabilityAfter = await withTenant(organizationId, () =>
      seatAssignmentService.getAvailability(organizationId),
    );
    expect(availabilityAfter).toEqual({ used: 1, limit: 1, available: 0, hasCapacity: false });

    // Assigning again for the same membership is idempotent, not a second seat.
    const reassigned = await withTenant(organizationId, () =>
      seatAssignmentService.assignSeat(organizationId, membership.id),
    );
    expect(reassigned.id).toBe(assigned.id);

    await withTenant(organizationId, () => seatAssignmentService.releaseSeat(membership.id));
    const availabilityAfterRelease = await withTenant(organizationId, () =>
      seatAssignmentService.getAvailability(organizationId),
    );
    expect(availabilityAfterRelease).toEqual({
      used: 0,
      limit: 1,
      available: 1,
      hasCapacity: true,
    });
  });
});
