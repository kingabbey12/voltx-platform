import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiSuccessResponse } from '../src/common/interceptors/response.interceptor';
import { PrismaService } from '../src/database/prisma.service';
import { UsersRepository } from '../src/modules/users/users.repository';
import { createTestApp } from './create-test-app';
import { authenticateContext, resetAndSeedAuthTestData } from './helpers/users-test.helper';

interface BrandThemeResponse {
  primaryColor: string | null;
  loginHeadline: string | null;
  logoUrl: string | null;
  emailTemplateOverrides: Record<string, unknown>;
}

interface CustomDomainResponse {
  id: string;
  domain: string;
  verificationStatus: string;
  verificationToken: string;
}

interface PublicBrandingResponse {
  organizationName: string;
  primaryColor: string | null;
  loginHeadline: string | null;
}

describe('Enterprise White-label / Branding (e2e)', () => {
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

  it('updates the brand theme and reads it back', async () => {
    const owner = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `branding-theme-${Date.now()}@example.com`,
    });

    const updateResponse = await request(app.getHttpServer())
      .patch(`/api/v1/organizations/${owner.organization.id}/branding/theme`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ primaryColor: '#112233', loginHeadline: 'Welcome to Acme' })
      .expect(200);
    const updated = (updateResponse.body as ApiSuccessResponse<BrandThemeResponse>).data;
    expect(updated.primaryColor).toBe('#112233');
    expect(updated.loginHeadline).toBe('Welcome to Acme');

    const getResponse = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${owner.organization.id}/branding/theme`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);
    const fetched = (getResponse.body as ApiSuccessResponse<BrandThemeResponse>).data;
    expect(fetched.primaryColor).toBe('#112233');
  });

  it('returns a null-safe default theme for an organization that never configured one', async () => {
    const owner = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `branding-default-${Date.now()}@example.com`,
    });

    const response = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${owner.organization.id}/branding/theme`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);
    const theme = (response.body as ApiSuccessResponse<BrandThemeResponse>).data;
    expect(theme.primaryColor).toBeNull();
    expect(theme.logoUrl).toBeNull();
  });

  it('uploads a logo and returns a fresh signed URL for it', async () => {
    const owner = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `branding-logo-${Date.now()}@example.com`,
    });

    const response = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${owner.organization.id}/branding/theme/logo`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .attach('file', Buffer.from('fake-png-bytes'), {
        filename: 'logo.png',
        contentType: 'image/png',
      })
      .expect(201);
    const theme = (response.body as ApiSuccessResponse<BrandThemeResponse>).data;
    expect(theme.logoUrl).toBeTruthy();
  });

  it('rejects a non-image file uploaded as a logo', async () => {
    const owner = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `branding-logo-reject-${Date.now()}@example.com`,
    });

    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${owner.organization.id}/branding/theme/logo`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .attach('file', Buffer.from('not an image'), {
        filename: 'malware.exe',
        contentType: 'application/octet-stream',
      })
      .expect(400);
  });

  it('registers a custom domain and exposes its verification token', async () => {
    const owner = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `branding-domain-${Date.now()}@example.com`,
    });

    const response = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${owner.organization.id}/branding/domains`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ domain: `login-${Date.now()}.example.com` })
      .expect(201);
    const domain = (response.body as ApiSuccessResponse<CustomDomainResponse>).data;
    expect(domain.verificationStatus).toBe('PENDING');
    expect(domain.verificationToken).toMatch(/^voltx-domain-verify-/);
  });

  it('DNS verification fails for a domain with no matching TXT record (no real DNS setup in tests)', async () => {
    const owner = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `branding-domain-verify-${Date.now()}@example.com`,
    });

    const createResponse = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${owner.organization.id}/branding/domains`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ domain: `unverified-${Date.now()}.example.com` })
      .expect(201);
    const domain = (createResponse.body as ApiSuccessResponse<CustomDomainResponse>).data;

    const verifyResponse = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${owner.organization.id}/branding/domains/${domain.id}/verify`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(200);
    const verified = (verifyResponse.body as ApiSuccessResponse<CustomDomainResponse>).data;
    expect(verified.verificationStatus).toBe('FAILED');
  });

  it('rejects registering a domain that is already claimed by another organization', async () => {
    const ownerA = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `branding-domain-a-${Date.now()}@example.com`,
    });
    const ownerB = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `branding-domain-b-${Date.now()}@example.com`,
    });
    const sharedDomain = `contested-${Date.now()}.example.com`;

    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${ownerA.organization.id}/branding/domains`)
      .set('Authorization', `Bearer ${ownerA.accessToken}`)
      .send({ domain: sharedDomain })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${ownerB.organization.id}/branding/domains`)
      .set('Authorization', `Bearer ${ownerB.accessToken}`)
      .send({ domain: sharedDomain })
      .expect(409);
  });

  it("never returns another organization's custom domains", async () => {
    const ownerA = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `branding-domain-list-a-${Date.now()}@example.com`,
    });
    const ownerB = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `branding-domain-list-b-${Date.now()}@example.com`,
    });

    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${ownerA.organization.id}/branding/domains`)
      .set('Authorization', `Bearer ${ownerA.accessToken}`)
      .send({ domain: `org-a-only-${Date.now()}.example.com` })
      .expect(201);

    const listAsB = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${ownerB.organization.id}/branding/domains`)
      .set('Authorization', `Bearer ${ownerB.accessToken}`)
      .expect(200);
    const domainsForB = (listAsB.body as ApiSuccessResponse<CustomDomainResponse[]>).data;
    expect(domainsForB).toEqual([]);
  });

  it('blocks a non-admin member from managing branding via RBAC', async () => {
    const member = await authenticateContext(app, prisma, usersRepository, 'member', {
      email: `branding-member-${Date.now()}@example.com`,
    });

    await request(app.getHttpServer())
      .patch(`/api/v1/organizations/${member.organization.id}/branding/theme`)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .send({ primaryColor: '#000000' })
      .expect(403);
  });

  it('exposes only public-safe branding fields via the unauthenticated public endpoint', async () => {
    const owner = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `branding-public-${Date.now()}@example.com`,
    });

    await request(app.getHttpServer())
      .patch(`/api/v1/organizations/${owner.organization.id}/branding/theme`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        primaryColor: '#445566',
        loginHeadline: 'Sign in to Acme',
        emailTemplateOverrides: { invitation: { subject: 'INTERNAL SECRET SUBJECT' } },
      })
      .expect(200);

    const publicResponse = await request(app.getHttpServer())
      .get(`/api/v1/branding/public/${owner.organization.slug}`)
      .expect(200);
    const publicBranding = (publicResponse.body as ApiSuccessResponse<PublicBrandingResponse>).data;

    expect(publicBranding.primaryColor).toBe('#445566');
    expect(publicBranding.loginHeadline).toBe('Sign in to Acme');
    expect(JSON.stringify(publicBranding)).not.toContain('INTERNAL SECRET SUBJECT');
    expect(Object.prototype.hasOwnProperty.call(publicBranding, 'emailTemplateOverrides')).toBe(
      false,
    );
  });

  it('returns 404 from the public endpoint for an unknown slug/domain', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/branding/public/this-org-does-not-exist')
      .expect(404);
  });
});
