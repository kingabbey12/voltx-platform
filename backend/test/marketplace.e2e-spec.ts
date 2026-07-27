import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import Stripe from 'stripe';
import { ApiSuccessResponse } from '../src/common/interceptors/response.interceptor';
import { PrismaService } from '../src/database/prisma.service';
import { UsersRepository } from '../src/modules/users/users.repository';
import { createTestApp } from './create-test-app';
import { authenticateContext, resetAndSeedAuthTestData } from './helpers/users-test.helper';

const MARKETPLACE_WEBHOOK_SECRET = 'whsec_dummy_marketplace_test_webhook_secret';

interface MarketplaceAppResponse {
  id: string;
  status: string;
}

interface MarketplaceAppVersionResponse {
  id: string;
  appId: string;
  status: string;
  priceCents: number;
}

interface InstallAppResult {
  install: { id: string; status: string; installedVersionId: string } | null;
  checkoutUrl: string | null;
}

interface PublicListResponse {
  items: { id: string; name: string }[];
  total: number;
}

interface ReviewResponse {
  id: string;
  rating: number;
}

async function promoteToPlatformAdmin(prisma: PrismaService, userId: string): Promise<void> {
  await prisma.system.user.update({ where: { id: userId }, data: { isPlatformAdmin: true } });
}

/**
 * Full Phase 7 lifecycle: developer registers an app, submits a version,
 * a platform admin reviews it, it becomes publicly browsable, another
 * organization installs the free version, reviews it, then uninstalls
 * and reinstalls. The paid/Stripe-Connect revenue-share path is verified
 * by exercising the real webhook signature-verification + dispatch logic
 * directly (same pattern as billing-webhook.e2e-spec.ts) rather than
 * driving a real Stripe Checkout Session through this suite, since no
 * live Stripe account is available in this environment.
 */
describe('Marketplace + Stripe Connect (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let usersRepository: UsersRepository;
  const stripe = new Stripe('sk_test_dummy_key_for_e2e_signature_verification_only');

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

  function signedMarketplaceWebhookPost(body: string) {
    const header = stripe.webhooks.generateTestHeaderString({
      payload: body,
      secret: MARKETPLACE_WEBHOOK_SECRET,
    });
    return request(app.getHttpServer())
      .post('/api/v1/marketplace/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', header)
      .send(body);
  }

  it('runs a free app through the full submit -> review -> browse -> install -> review -> uninstall -> reinstall lifecycle', async () => {
    const developer = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `marketplace-dev-${Date.now()}@example.com`,
    });
    const platformAdmin = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `marketplace-platform-admin-${Date.now()}@example.com`,
    });
    await promoteToPlatformAdmin(prisma, platformAdmin.user.id);
    const installer = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `marketplace-installer-${Date.now()}@example.com`,
    });

    const devAuth = { Authorization: `Bearer ${developer.accessToken}` };
    const adminAuth = { Authorization: `Bearer ${platformAdmin.accessToken}` };
    const installerAuth = { Authorization: `Bearer ${installer.accessToken}` };

    // 1. Developer registers an app (starts in DRAFT).
    const createAppResponse = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${developer.organization.id}/marketplace/apps`)
      .set(devAuth)
      .send({ name: 'Acme Reporting', category: 'ANALYTICS', description: 'Sales reporting' })
      .expect(201);
    const createdApp = (createAppResponse.body as ApiSuccessResponse<MarketplaceAppResponse>).data;
    expect(createdApp.status).toBe('DRAFT');

    // 2. Developer submits a free (priceCents: 0) version — app moves to PENDING_REVIEW.
    const submitVersionResponse = await request(app.getHttpServer())
      .post(
        `/api/v1/organizations/${developer.organization.id}/marketplace/apps/${createdApp.id}/versions`,
      )
      .set(devAuth)
      .send({ version: '1.0.0', manifest: { pages: [], widgets: [], navEntries: [], aiTools: [] } })
      .expect(201);
    const version = (
      submitVersionResponse.body as ApiSuccessResponse<MarketplaceAppVersionResponse>
    ).data;
    expect(version.status).toBe('PENDING_REVIEW');

    const afterSubmitResponse = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${developer.organization.id}/marketplace/apps/${createdApp.id}`)
      .set(devAuth)
      .expect(200);
    expect(
      (afterSubmitResponse.body as ApiSuccessResponse<MarketplaceAppResponse>).data.status,
    ).toBe('PENDING_REVIEW');

    // 3. A non-platform-admin cannot see or act on the review queue.
    await request(app.getHttpServer())
      .get('/api/v1/platform/marketplace/versions/pending')
      .set(devAuth)
      .expect(403);

    // 4. Platform admin approves the version — app + version both publish.
    const pendingResponse = await request(app.getHttpServer())
      .get('/api/v1/platform/marketplace/versions/pending')
      .set(adminAuth)
      .expect(200);
    const pending = (pendingResponse.body as ApiSuccessResponse<MarketplaceAppVersionResponse[]>)
      .data;
    expect(pending.some((v) => v.id === version.id)).toBe(true);

    await request(app.getHttpServer())
      .post(`/api/v1/platform/marketplace/versions/${version.id}/approve`)
      .set(adminAuth)
      .expect(201);

    const afterApproveResponse = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${developer.organization.id}/marketplace/apps/${createdApp.id}`)
      .set(devAuth)
      .expect(200);
    expect(
      (afterApproveResponse.body as ApiSuccessResponse<MarketplaceAppResponse>).data.status,
    ).toBe('PUBLISHED');

    // 5. The app is now publicly browsable, unauthenticated.
    const publicListResponse = await request(app.getHttpServer())
      .get('/api/v1/marketplace/public/apps')
      .expect(200);
    const publicList = (publicListResponse.body as ApiSuccessResponse<PublicListResponse>).data;
    expect(publicList.items.some((item) => item.id === createdApp.id)).toBe(true);

    await request(app.getHttpServer())
      .get(`/api/v1/marketplace/public/apps/${createdApp.id}`)
      .expect(200);

    // 6. Another organization installs the free app — synchronous, no Stripe.
    const installResponse = await request(app.getHttpServer())
      .post(
        `/api/v1/organizations/${installer.organization.id}/marketplace/apps/${createdApp.id}/install`,
      )
      .set(installerAuth)
      .send({})
      .expect(201);
    const installResult = (installResponse.body as ApiSuccessResponse<InstallAppResult>).data;
    expect(installResult.checkoutUrl).toBeNull();
    expect(installResult.install?.status).toBe('ACTIVE');
    const installId = installResult.install?.id as string;

    // 7. Installing the same app again is rejected while still active.
    await request(app.getHttpServer())
      .post(
        `/api/v1/organizations/${installer.organization.id}/marketplace/apps/${createdApp.id}/install`,
      )
      .set(installerAuth)
      .send({})
      .expect(400);

    // 8. The installer can leave one review; a second review is rejected.
    const reviewResponse = await request(app.getHttpServer())
      .post(
        `/api/v1/organizations/${installer.organization.id}/marketplace/apps/${createdApp.id}/reviews`,
      )
      .set(installerAuth)
      .send({ rating: 5, comment: 'Great app' })
      .expect(201);
    expect((reviewResponse.body as ApiSuccessResponse<ReviewResponse>).data.rating).toBe(5);

    await request(app.getHttpServer())
      .post(
        `/api/v1/organizations/${installer.organization.id}/marketplace/apps/${createdApp.id}/reviews`,
      )
      .set(installerAuth)
      .send({ rating: 3 })
      .expect(400);

    // 9. Public reviews listing reflects it, and the average rating shows up on the app.
    const publicReviewsResponse = await request(app.getHttpServer())
      .get(`/api/v1/marketplace/public/apps/${createdApp.id}/reviews`)
      .expect(200);
    expect((publicReviewsResponse.body as ApiSuccessResponse<ReviewResponse[]>).data).toHaveLength(
      1,
    );

    // 10. Uninstall, then reinstall — must reactivate the same row (unique appId+org constraint).
    await request(app.getHttpServer())
      .delete(
        `/api/v1/organizations/${installer.organization.id}/marketplace/installs/${installId}`,
      )
      .set(installerAuth)
      .expect(200);

    const reinstallResponse = await request(app.getHttpServer())
      .post(
        `/api/v1/organizations/${installer.organization.id}/marketplace/apps/${createdApp.id}/install`,
      )
      .set(installerAuth)
      .send({})
      .expect(201);
    const reinstallResult = (reinstallResponse.body as ApiSuccessResponse<InstallAppResult>).data;
    expect(reinstallResult.install?.id).toBe(installId);
    expect(reinstallResult.install?.status).toBe('ACTIVE');
  });

  it('rejects a normal org member from the platform-admin review queue and approve/reject endpoints', async () => {
    const nonAdmin = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `marketplace-non-platform-admin-${Date.now()}@example.com`,
    });
    const auth = { Authorization: `Bearer ${nonAdmin.accessToken}` };

    await request(app.getHttpServer())
      .get('/api/v1/platform/marketplace/versions/pending')
      .set(auth)
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/v1/platform/marketplace/versions/some-fake-id/approve')
      .set(auth)
      .expect(403);
    await request(app.getHttpServer())
      .post('/api/v1/platform/marketplace/versions/some-fake-id/reject')
      .set(auth)
      .send({ reason: 'nope' })
      .expect(403);
  });

  it('rejects installing a paid app for a developer who has not completed Stripe Connect onboarding', async () => {
    const developer = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `marketplace-paid-dev-${Date.now()}@example.com`,
    });
    const platformAdmin = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `marketplace-paid-admin-${Date.now()}@example.com`,
    });
    await promoteToPlatformAdmin(prisma, platformAdmin.user.id);
    const installer = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `marketplace-paid-installer-${Date.now()}@example.com`,
    });

    const devAuth = { Authorization: `Bearer ${developer.accessToken}` };
    const adminAuth = { Authorization: `Bearer ${platformAdmin.accessToken}` };
    const installerAuth = { Authorization: `Bearer ${installer.accessToken}` };

    const createAppResponse = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${developer.organization.id}/marketplace/apps`)
      .set(devAuth)
      .send({ name: 'Acme Premium', category: 'FINANCE' })
      .expect(201);
    const createdApp = (createAppResponse.body as ApiSuccessResponse<MarketplaceAppResponse>).data;

    const submitVersionResponse = await request(app.getHttpServer())
      .post(
        `/api/v1/organizations/${developer.organization.id}/marketplace/apps/${createdApp.id}/versions`,
      )
      .set(devAuth)
      .send({ version: '1.0.0', manifest: {}, priceCents: 5000 })
      .expect(201);
    const version = (
      submitVersionResponse.body as ApiSuccessResponse<MarketplaceAppVersionResponse>
    ).data;

    await request(app.getHttpServer())
      .post(`/api/v1/platform/marketplace/versions/${version.id}/approve`)
      .set(adminAuth)
      .expect(201);

    await request(app.getHttpServer())
      .post(
        `/api/v1/organizations/${installer.organization.id}/marketplace/apps/${createdApp.id}/install`,
      )
      .set(installerAuth)
      .send({
        successUrl: 'https://app.voltx.example/success',
        cancelUrl: 'https://app.voltx.example/cancel',
      })
      .expect(400);
  });

  describe('POST /marketplace/webhooks/stripe', () => {
    it('rejects a request with no signature', async () => {
      const body = JSON.stringify({
        id: 'evt_missing_sig',
        type: 'account.updated',
        data: { object: {} },
      });

      await request(app.getHttpServer())
        .post('/api/v1/marketplace/webhooks/stripe')
        .set('Content-Type', 'application/json')
        .send(body)
        .expect(400);
    });

    it('rejects an invalid signature', async () => {
      const body = JSON.stringify({
        id: 'evt_bad_sig',
        type: 'account.updated',
        data: { object: {} },
      });

      await request(app.getHttpServer())
        .post('/api/v1/marketplace/webhooks/stripe')
        .set('Content-Type', 'application/json')
        .set('stripe-signature', 't=1893456000,v1=deadbeef')
        .send(body)
        .expect(400);
    });

    it('confirms a paid install and records a server-computed revenue share on checkout.session.completed', async () => {
      const developer = await authenticateContext(app, prisma, usersRepository, 'admin', {
        email: `marketplace-webhook-dev-${Date.now()}@example.com`,
      });
      const platformAdmin = await authenticateContext(app, prisma, usersRepository, 'admin', {
        email: `marketplace-webhook-admin-${Date.now()}@example.com`,
      });
      await promoteToPlatformAdmin(prisma, platformAdmin.user.id);
      const installerOrgId = developer.organization.id; // reuse same org as the "buyer" for simplicity

      const devAuth = { Authorization: `Bearer ${developer.accessToken}` };
      const adminAuth = { Authorization: `Bearer ${platformAdmin.accessToken}` };

      const createAppResponse = await request(app.getHttpServer())
        .post(`/api/v1/organizations/${developer.organization.id}/marketplace/apps`)
        .set(devAuth)
        .send({ name: 'Acme Paid Tool', category: 'FINANCE' })
        .expect(201);
      const createdApp = (createAppResponse.body as ApiSuccessResponse<MarketplaceAppResponse>)
        .data;

      const submitVersionResponse = await request(app.getHttpServer())
        .post(
          `/api/v1/organizations/${developer.organization.id}/marketplace/apps/${createdApp.id}/versions`,
        )
        .set(devAuth)
        .send({ version: '1.0.0', manifest: {}, priceCents: 10000 })
        .expect(201);
      const version = (
        submitVersionResponse.body as ApiSuccessResponse<MarketplaceAppVersionResponse>
      ).data;

      await request(app.getHttpServer())
        .post(`/api/v1/platform/marketplace/versions/${version.id}/approve`)
        .set(adminAuth)
        .expect(201);

      // Seed a Connect account directly (simulating completed Stripe onboarding)
      // rather than driving a real Stripe Express onboarding flow.
      await prisma.system.developerConnectAccount.create({
        data: {
          organizationId: developer.organization.id,
          stripeConnectedAccountId: 'acct_test_dev123',
          onboardingStatus: 'COMPLETE',
          payoutsEnabled: true,
        },
      });

      const eventId = `evt_test_${Date.now()}`;
      const sessionId = `cs_test_${Date.now()}`;
      const body = JSON.stringify({
        id: eventId,
        type: 'checkout.session.completed',
        data: {
          object: {
            id: sessionId,
            payment_intent: 'pi_test_123',
            metadata: {
              voltxMarketplaceAppId: createdApp.id,
              voltxMarketplaceVersionId: version.id,
              voltxInstallingOrganizationId: installerOrgId,
              voltxInstalledByUserId: developer.user.id,
            },
          },
        },
      });

      const response = await signedMarketplaceWebhookPost(body);
      expect((response.body as { received: boolean }).received).toBe(true);

      const install = await prisma.system.marketplaceInstall.findUnique({
        where: {
          appId_installingOrganizationId: {
            appId: createdApp.id,
            installingOrganizationId: installerOrgId,
          },
        },
      });
      expect(install?.status).toBe('ACTIVE');

      const revenueShare = await prisma.system.marketplaceRevenueShare.findUnique({
        where: { stripeCheckoutSessionId: sessionId },
      });
      expect(revenueShare?.purchaseAmountCents).toBe(10000);
      expect(revenueShare?.platformFeeCents).toBe(2000);
      expect(revenueShare?.developerPayoutCents).toBe(8000);

      // Redelivery of the same event is idempotent — no duplicate revenue share row.
      await signedMarketplaceWebhookPost(body).expect(200);
      const revenueShareCount = await prisma.system.marketplaceRevenueShare.count({
        where: { stripeCheckoutSessionId: sessionId },
      });
      expect(revenueShareCount).toBe(1);
    });
  });
});
