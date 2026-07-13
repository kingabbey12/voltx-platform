import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiSuccessResponse } from '../src/common/interceptors/response.interceptor';
import { PrismaService } from '../src/database/prisma.service';
import { UsersRepository } from '../src/modules/users/users.repository';
import { computeCodeChallengeS256 } from '../src/modules/oauth-provider/utils/pkce.util';
import { createTestApp } from './create-test-app';
import { authenticateContext, resetAndSeedAuthTestData } from './helpers/users-test.helper';

interface CreateOAuthApplicationResponse {
  id: string;
  clientId: string;
  clientSecret: string;
}

interface OAuthDecisionResponse {
  redirectUrl: string;
}

interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

interface OAuthIntrospectResponse {
  active: boolean;
}

interface WhoamiResponse {
  organizationId: string;
  permissions: string[];
}

interface OAuthConsentContextResponse {
  applicationName: string;
}

const CODE_VERIFIER = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
const CODE_CHALLENGE = computeCodeChallengeS256(CODE_VERIFIER);
const REDIRECT_URI = 'https://example.com/oauth/callback';

describe('OAuth Provider — Applications & Authorization Server (e2e)', () => {
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

  async function registerApplication(
    accessToken: string,
    organizationId: string,
    scopes: string[] = ['organization.read'],
  ): Promise<CreateOAuthApplicationResponse> {
    const response = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationId}/oauth-applications`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Acme Reporting',
        redirectUris: [REDIRECT_URI],
        scopes,
      })
      .expect(201);
    return (response.body as ApiSuccessResponse<CreateOAuthApplicationResponse>).data;
  }

  it('runs the full authorization_code + PKCE lifecycle: register, consent, exchange, whoami, refresh, revoke', async () => {
    const owner = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `oauth-lifecycle-${Date.now()}@example.com`,
    });
    const auth = { Authorization: `Bearer ${owner.accessToken}` };

    const application = await registerApplication(owner.accessToken, owner.organization.id);
    expect(application.clientSecret).toMatch(/^vcs_/);

    const consentResponse = await request(app.getHttpServer())
      .get('/api/v1/oauth/authorize')
      .set(auth)
      .query({
        client_id: application.clientId,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: 'organization.read',
        state: 'xyz123',
        code_challenge: CODE_CHALLENGE,
        code_challenge_method: 'S256',
      })
      .expect(200);
    const consentContext = (consentResponse.body as ApiSuccessResponse<OAuthConsentContextResponse>)
      .data;
    expect(consentContext.applicationName).toBe('Acme Reporting');

    const decideResponse = await request(app.getHttpServer())
      .post('/api/v1/oauth/authorize/decide')
      .set(auth)
      .send({
        client_id: application.clientId,
        redirect_uri: REDIRECT_URI,
        scope: 'organization.read',
        state: 'xyz123',
        code_challenge: CODE_CHALLENGE,
        code_challenge_method: 'S256',
        decision: 'approve',
      })
      .expect(200);
    const decision = (decideResponse.body as ApiSuccessResponse<OAuthDecisionResponse>).data;
    const redirectUrl = new URL(decision.redirectUrl);
    const code = redirectUrl.searchParams.get('code');
    expect(redirectUrl.searchParams.get('state')).toBe('xyz123');
    expect(code).toBeTruthy();

    const tokenResponse = await request(app.getHttpServer())
      .post('/api/v1/oauth/token')
      .send({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        code_verifier: CODE_VERIFIER,
        client_id: application.clientId,
        client_secret: application.clientSecret,
      })
      .expect(200);
    const tokens = tokenResponse.body as OAuthTokenResponse;
    expect(tokens.access_token).toMatch(/^voat_/);
    expect(tokens.refresh_token).toMatch(/^vort_/);
    expect(tokens.token_type).toBe('Bearer');
    expect(tokens.scope).toBe('organization.read');

    const whoamiResponse = await request(app.getHttpServer())
      .get('/api/v1/oauth/whoami')
      .set('Authorization', `Bearer ${tokens.access_token}`)
      .expect(200);
    const whoami = (whoamiResponse.body as ApiSuccessResponse<WhoamiResponse>).data;
    expect(whoami.organizationId).toBe(owner.organization.id);
    expect(whoami.permissions).toEqual(['organization.read']);

    const refreshResponse = await request(app.getHttpServer())
      .post('/api/v1/oauth/token')
      .send({
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh_token,
        client_id: application.clientId,
        client_secret: application.clientSecret,
      })
      .expect(200);
    const refreshed = refreshResponse.body as OAuthTokenResponse;
    expect(refreshed.access_token).toMatch(/^voat_/);
    expect(refreshed.access_token).not.toBe(tokens.access_token);

    // Refresh token rotation: the original refresh token is now revoked.
    await request(app.getHttpServer())
      .post('/api/v1/oauth/token')
      .send({
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh_token,
        client_id: application.clientId,
        client_secret: application.clientSecret,
      })
      .expect(400);

    const introspectActive = await request(app.getHttpServer())
      .post('/api/v1/oauth/introspect')
      .send({
        token: refreshed.access_token,
        client_id: application.clientId,
        client_secret: application.clientSecret,
      })
      .expect(200);
    expect((introspectActive.body as OAuthIntrospectResponse).active).toBe(true);

    await request(app.getHttpServer())
      .post('/api/v1/oauth/revoke')
      .send({
        token: refreshed.access_token,
        client_id: application.clientId,
        client_secret: application.clientSecret,
      })
      .expect(200);

    const introspectRevoked = await request(app.getHttpServer())
      .post('/api/v1/oauth/introspect')
      .send({
        token: refreshed.access_token,
        client_id: application.clientId,
        client_secret: application.clientSecret,
      })
      .expect(200);
    expect((introspectRevoked.body as OAuthIntrospectResponse).active).toBe(false);

    await request(app.getHttpServer())
      .get('/api/v1/oauth/whoami')
      .set('Authorization', `Bearer ${refreshed.access_token}`)
      .expect(401);
  });

  it('rejects a token exchange whose code_verifier does not match the code_challenge', async () => {
    const owner = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `oauth-pkce-mismatch-${Date.now()}@example.com`,
    });
    const application = await registerApplication(owner.accessToken, owner.organization.id);

    const decideResponse = await request(app.getHttpServer())
      .post('/api/v1/oauth/authorize/decide')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        client_id: application.clientId,
        redirect_uri: REDIRECT_URI,
        scope: 'organization.read',
        code_challenge: CODE_CHALLENGE,
        code_challenge_method: 'S256',
        decision: 'approve',
      })
      .expect(200);
    const code = new URL(
      (decideResponse.body as ApiSuccessResponse<OAuthDecisionResponse>).data.redirectUrl,
    ).searchParams.get('code');

    const response = await request(app.getHttpServer())
      .post('/api/v1/oauth/token')
      .send({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
        code_verifier: 'this-is-not-the-right-verifier-at-all-123456789',
        client_id: application.clientId,
        client_secret: application.clientSecret,
      })
      .expect(400);
    expect((response.body as { error: string }).error).toBe('invalid_grant');
  });

  it('rejects an authorization code that has already been used (replay)', async () => {
    const owner = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `oauth-replay-${Date.now()}@example.com`,
    });
    const application = await registerApplication(owner.accessToken, owner.organization.id);

    const decideResponse = await request(app.getHttpServer())
      .post('/api/v1/oauth/authorize/decide')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        client_id: application.clientId,
        redirect_uri: REDIRECT_URI,
        scope: 'organization.read',
        code_challenge: CODE_CHALLENGE,
        code_challenge_method: 'S256',
        decision: 'approve',
      })
      .expect(200);
    const code = new URL(
      (decideResponse.body as ApiSuccessResponse<OAuthDecisionResponse>).data.redirectUrl,
    ).searchParams.get('code');

    const exchange = {
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
      code_verifier: CODE_VERIFIER,
      client_id: application.clientId,
      client_secret: application.clientSecret,
    };

    await request(app.getHttpServer()).post('/api/v1/oauth/token').send(exchange).expect(200);
    const replay = await request(app.getHttpServer())
      .post('/api/v1/oauth/token')
      .send(exchange)
      .expect(400);
    expect((replay.body as { error: string }).error).toBe('invalid_grant');
  });

  it('rejects a redirect_uri that does not match any URI registered for the application', async () => {
    const owner = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `oauth-redirect-mismatch-${Date.now()}@example.com`,
    });
    const application = await registerApplication(owner.accessToken, owner.organization.id);

    await request(app.getHttpServer())
      .get('/api/v1/oauth/authorize')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .query({
        client_id: application.clientId,
        redirect_uri: 'https://evil.example/callback',
        response_type: 'code',
        scope: 'organization.read',
        code_challenge: CODE_CHALLENGE,
        code_challenge_method: 'S256',
      })
      .expect(400);
  });

  it('rejects authorizing a scope the user does not currently hold', async () => {
    const viewer = await authenticateContext(app, prisma, usersRepository, 'viewer', {
      email: `oauth-scope-escalation-${Date.now()}@example.com`,
    });
    const admin = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `oauth-scope-escalation-admin-${Date.now()}@example.com`,
    });
    // Registered by an admin with a broad scope; the viewer then tries to
    // authorize a scope they personally don't hold.
    const application = await registerApplication(admin.accessToken, admin.organization.id, [
      'organization.read',
      'organization.delete',
    ]);

    await request(app.getHttpServer())
      .post('/api/v1/oauth/authorize/decide')
      .set('Authorization', `Bearer ${viewer.accessToken}`)
      .send({
        client_id: application.clientId,
        redirect_uri: REDIRECT_URI,
        scope: 'organization.delete',
        code_challenge: CODE_CHALLENGE,
        code_challenge_method: 'S256',
        decision: 'approve',
      })
      .expect(403);
  });

  it('rejects registering an OAuth application scoped to permissions the caller does not hold', async () => {
    const manager = await authenticateContext(app, prisma, usersRepository, 'manager', {
      email: `oauth-register-escalation-${Date.now()}@example.com`,
    });

    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${manager.organization.id}/oauth-applications`)
      .set('Authorization', `Bearer ${manager.accessToken}`)
      .send({
        name: 'Escalation attempt',
        redirectUris: [REDIRECT_URI],
        scopes: ['permission.delete'],
      })
      .expect(403);
  });

  it('never lets an OAuth application registered in one organization be listed from another', async () => {
    const orgA = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `oauth-isolation-a-${Date.now()}@example.com`,
    });
    const orgB = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `oauth-isolation-b-${Date.now()}@example.com`,
    });

    await registerApplication(orgA.accessToken, orgA.organization.id);

    const listAsB = await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgB.organization.id}/oauth-applications`)
      .set('Authorization', `Bearer ${orgB.accessToken}`)
      .expect(200);
    expect((listAsB.body as ApiSuccessResponse<unknown[]>).data).toEqual([]);

    await request(app.getHttpServer())
      .get(`/api/v1/organizations/${orgA.organization.id}/oauth-applications`)
      .set('Authorization', `Bearer ${orgB.accessToken}`)
      .expect(403);
  });

  it('rejects registering a non-https, non-loopback redirect URI', async () => {
    const owner = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `oauth-insecure-redirect-${Date.now()}@example.com`,
    });

    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${owner.organization.id}/oauth-applications`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        name: 'Insecure app',
        redirectUris: ['http://example.com/callback'],
        scopes: ['organization.read'],
      })
      .expect(400);
  });
});
