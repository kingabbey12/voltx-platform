import * as crypto from 'node:crypto';
import * as http from 'node:http';
import type { AddressInfo } from 'node:net';
import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiSuccessResponse } from '../src/common/interceptors/response.interceptor';
import { PrismaService } from '../src/database/prisma.service';
import { UsersRepository } from '../src/modules/users/users.repository';
import { LoginResponseDto } from '../src/modules/auth/dto/auth-response.dto';
import { createTestApp } from './create-test-app';
import { authenticateContext, resetAndSeedAuthTestData } from './helpers/users-test.helper';

interface IdentityProviderResponse {
  id: string;
  organizationId: string;
  protocol: 'SAML' | 'OIDC';
  status: string;
}

interface ErrorResponseBody {
  success: false;
  error: { code: string; message: string; details?: unknown };
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function signRs256Jwt(payload: Record<string, unknown>, privateKey: crypto.KeyObject, kid: string): string {
  const header = { alg: 'RS256', typ: 'JWT', kid };
  const signingInput = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;
  const signature = crypto.sign('RSA-SHA256', Buffer.from(signingInput), privateKey);
  return `${signingInput}.${signature.toString('base64url')}`;
}

/** A minimal fake OIDC provider: serves a fixed JWKS and a token endpoint that always returns one canned, freshly-signed ID token. */
class FakeOidcProvider {
  readonly kid = 'test-key-1';
  private readonly privateKey: crypto.KeyObject;
  private readonly publicJwk: Record<string, unknown>;
  private server: http.Server | undefined;
  private nextIdTokenClaims: Record<string, unknown> | undefined;

  constructor() {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
    this.privateKey = privateKey;
    this.publicJwk = { ...publicKey.export({ format: 'jwk' }), kid: this.kid, use: 'sig', alg: 'RS256' };
  }

  setNextIdTokenClaims(claims: Record<string, unknown>): void {
    this.nextIdTokenClaims = claims;
  }

  async start(): Promise<string> {
    this.server = http.createServer((req, res) => {
      if (req.url === '/jwks') {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ keys: [this.publicJwk] }));
        return;
      }
      if (req.url === '/token' && req.method === 'POST') {
        if (!this.nextIdTokenClaims) {
          res.statusCode = 500;
          res.end('no id token configured');
          return;
        }
        const idToken = signRs256Jwt(this.nextIdTokenClaims, this.privateKey, this.kid);
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ access_token: 'fake-access-token', token_type: 'Bearer', id_token: idToken }));
        return;
      }
      res.statusCode = 404;
      res.end('not found');
    });

    await new Promise<void>((resolve) => this.server?.listen(0, '127.0.0.1', resolve));
    const address = this.server.address() as AddressInfo;
    return `http://127.0.0.1:${address.port}`;
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve, reject) =>
      this.server?.close((err) => (err ? reject(err) : resolve())),
    );
  }
}

describe('Enterprise Identity — SSO (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let usersRepository: UsersRepository;
  let jwtService: JwtService;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    usersRepository = app.get(UsersRepository);
    jwtService = app.get(JwtService);
  });

  beforeEach(async () => {
    await resetAndSeedAuthTestData(prisma);
  });

  afterAll(async () => {
    await resetAndSeedAuthTestData(prisma);
    await app.close();
  });

  async function createOidcProvider(
    accessToken: string,
    organizationId: string,
    fakeIdpBaseUrl: string,
  ): Promise<IdentityProviderResponse> {
    const createResponse = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${organizationId}/identity/providers`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Fake OIDC IdP',
        protocol: 'OIDC',
        preset: 'OKTA',
        oidcConfiguration: {
          issuer: fakeIdpBaseUrl,
          clientId: 'test-client-id',
          clientSecret: 'test-client-secret',
        },
      })
      .expect(201);
    const created = (createResponse.body as ApiSuccessResponse<IdentityProviderResponse>).data;

    // The create DTO deliberately doesn't expose raw endpoint overrides —
    // real admins rely on OIDC discovery against `issuer`. Poking the DB
    // directly here stands in for that discovery document so the e2e run
    // doesn't need real network access to a live IdP.
    await prisma.oidcConfiguration.update({
      where: { identityProviderId: created.id },
      data: {
        authorizationEndpoint: `${fakeIdpBaseUrl}/authorize`,
        tokenEndpoint: `${fakeIdpBaseUrl}/token`,
        jwksUri: `${fakeIdpBaseUrl}/jwks`,
      },
    });

    await request(app.getHttpServer())
      .patch(`/api/v1/organizations/${organizationId}/identity/providers/${created.id}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ status: 'ACTIVE' })
      .expect(200);

    return created;
  }

  it('completes a full OIDC login → callback → JIT provisioning → JWT flow for a brand-new user', async () => {
    const owner = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `sso-owner-${Date.now()}@example.com`,
    });

    const fakeIdp = new FakeOidcProvider();
    const fakeIdpBaseUrl = await fakeIdp.start();
    try {
      const idp = await createOidcProvider(owner.accessToken, owner.organization.id, fakeIdpBaseUrl);

      const loginResponse = await request(app.getHttpServer())
        .get(`/api/v1/auth/sso/oidc/${idp.id}/login`)
        .expect(302);
      const redirectUrl = new URL(loginResponse.headers.location as string);
      const state = redirectUrl.searchParams.get('state')!;
      expect(state).toBeTruthy();

      const decodedState = jwtService.decode(state) as { idp: string; nonce: string };
      expect(decodedState.idp).toBe(idp.id);

      const ssoEmail = `new-sso-user-${Date.now()}@example.com`;
      fakeIdp.setNextIdTokenClaims({
        iss: fakeIdpBaseUrl,
        aud: 'test-client-id',
        sub: 'idp-subject-1',
        nonce: decodedState.nonce,
        email: ssoEmail,
        given_name: 'New',
        family_name: 'Person',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 300,
      });

      const callbackResponse = await request(app.getHttpServer())
        .get(`/api/v1/auth/sso/oidc/${idp.id}/callback`)
        .query({ code: 'test-authorization-code', state })
        .expect(200);
      const session = (callbackResponse.body as ApiSuccessResponse<LoginResponseDto>).data;
      expect(session.accessToken).toBeTruthy();
      expect(session.user.email).toBe(ssoEmail);

      const meResponse = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .expect(200);
      expect((meResponse.body as ApiSuccessResponse<{ organizationId: string }>).data.organizationId).toBe(
        owner.organization.id,
      );

      const membership = await prisma.system.membership.findFirst({
        where: { organizationId: owner.organization.id, userId: session.user.id },
      });
      expect(membership?.provisionedByIdentityProviderId).toBe(idp.id);
    } finally {
      await fakeIdp.stop();
    }
  });

  it("never lets organization A's identity provider provision a membership into organization B", async () => {
    const ownerA = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `sso-org-a-${Date.now()}@example.com`,
    });
    const ownerB = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `sso-org-b-${Date.now()}@example.com`,
    });

    const fakeIdp = new FakeOidcProvider();
    const fakeIdpBaseUrl = await fakeIdp.start();
    try {
      // IdP configured for org A only.
      const idpForOrgA = await createOidcProvider(
        ownerA.accessToken,
        ownerA.organization.id,
        fakeIdpBaseUrl,
      );

      const loginResponse = await request(app.getHttpServer())
        .get(`/api/v1/auth/sso/oidc/${idpForOrgA.id}/login`)
        .expect(302);
      const state = new URL(loginResponse.headers.location as string).searchParams.get('state')!;
      const decodedState = jwtService.decode(state) as { idp: string; nonce: string };

      const sharedEmail = `cross-tenant-target-${Date.now()}@example.com`;
      fakeIdp.setNextIdTokenClaims({
        iss: fakeIdpBaseUrl,
        aud: 'test-client-id',
        sub: 'idp-subject-2',
        nonce: decodedState.nonce,
        email: sharedEmail,
        given_name: 'Cross',
        family_name: 'Tenant',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 300,
      });

      const callbackResponse = await request(app.getHttpServer())
        .get(`/api/v1/auth/sso/oidc/${idpForOrgA.id}/callback`)
        .query({ code: 'test-authorization-code', state })
        .expect(200);
      const session = (callbackResponse.body as ApiSuccessResponse<LoginResponseDto>).data;

      // The provisioned membership must exist in org A only, never org B.
      const membershipInOrgA = await prisma.system.membership.findFirst({
        where: { organizationId: ownerA.organization.id, userId: session.user.id },
      });
      const membershipInOrgB = await prisma.system.membership.findFirst({
        where: { organizationId: ownerB.organization.id, userId: session.user.id },
      });
      expect(membershipInOrgA).not.toBeNull();
      expect(membershipInOrgB).toBeNull();

      // The issued session token is scoped to org A, not org B.
      const meResponse = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${session.accessToken}`)
        .expect(200);
      expect((meResponse.body as ApiSuccessResponse<{ organizationId: string }>).data.organizationId).toBe(
        ownerA.organization.id,
      );
    } finally {
      await fakeIdp.stop();
    }
  });

  it('rejects an OIDC callback whose state was minted for a different identity provider', async () => {
    const owner = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `sso-mismatch-${Date.now()}@example.com`,
    });

    const fakeIdp = new FakeOidcProvider();
    const fakeIdpBaseUrl = await fakeIdp.start();
    try {
      const idpOne = await createOidcProvider(owner.accessToken, owner.organization.id, fakeIdpBaseUrl);
      const idpTwo = await createOidcProvider(owner.accessToken, owner.organization.id, fakeIdpBaseUrl);

      const loginResponse = await request(app.getHttpServer())
        .get(`/api/v1/auth/sso/oidc/${idpOne.id}/login`)
        .expect(302);
      const state = new URL(loginResponse.headers.location as string).searchParams.get('state')!;

      const response = await request(app.getHttpServer())
        .get(`/api/v1/auth/sso/oidc/${idpTwo.id}/callback`)
        .query({ code: 'test-authorization-code', state })
        .expect(401);
      expect((response.body as ErrorResponseBody).success).toBe(false);
    } finally {
      await fakeIdp.stop();
    }
  });

  it('rejects a SAML ACS POST with a missing SAMLResponse body', async () => {
    const owner = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `sso-saml-missing-${Date.now()}@example.com`,
    });

    const createResponse = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${owner.organization.id}/identity/providers`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        name: 'Fake SAML IdP',
        protocol: 'SAML',
        samlConfiguration: {
          idpEntityId: 'https://fake-saml-idp.example.com',
          idpSsoUrl: 'https://fake-saml-idp.example.com/sso',
          idpCertificate: 'NOT-A-REAL-CERTIFICATE',
        },
      })
      .expect(201);
    const idp = (createResponse.body as ApiSuccessResponse<IdentityProviderResponse>).data;

    await request(app.getHttpServer())
      .post(`/api/v1/auth/sso/saml/${idp.id}/acs`)
      .send({})
      .expect(400);
  });

  it('rejects importing malformed SAML metadata XML', async () => {
    const owner = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `sso-saml-metadata-${Date.now()}@example.com`,
    });

    const createResponse = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${owner.organization.id}/identity/providers`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        name: 'Fake SAML IdP',
        protocol: 'SAML',
        samlConfiguration: {
          idpEntityId: 'https://fake-saml-idp.example.com',
          idpSsoUrl: 'https://fake-saml-idp.example.com/sso',
          idpCertificate: 'NOT-A-REAL-CERTIFICATE',
        },
      })
      .expect(201);
    const idp = (createResponse.body as ApiSuccessResponse<IdentityProviderResponse>).data;

    await request(app.getHttpServer())
      .post(
        `/api/v1/organizations/${owner.organization.id}/identity/providers/${idp.id}/saml/metadata/import`,
      )
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ metadataXml: '<not-valid-saml-metadata/>' })
      .expect(400);
  });

  it('rejects a login attempt against a DRAFT (not yet activated) identity provider', async () => {
    const owner = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `sso-draft-${Date.now()}@example.com`,
    });

    const fakeIdp = new FakeOidcProvider();
    const fakeIdpBaseUrl = await fakeIdp.start();
    try {
      const createResponse = await request(app.getHttpServer())
        .post(`/api/v1/organizations/${owner.organization.id}/identity/providers`)
        .set('Authorization', `Bearer ${owner.accessToken}`)
        .send({
          name: 'Draft OIDC IdP',
          protocol: 'OIDC',
          preset: 'OKTA',
          oidcConfiguration: {
            issuer: fakeIdpBaseUrl,
            clientId: 'test-client-id',
            clientSecret: 'test-client-secret',
          },
        })
        .expect(201);
      const idp = (createResponse.body as ApiSuccessResponse<IdentityProviderResponse>).data;
      expect(idp.status).toBe('DRAFT');

      await request(app.getHttpServer()).get(`/api/v1/auth/sso/oidc/${idp.id}/login`).expect(401);
    } finally {
      await fakeIdp.stop();
    }
  });

  it('blocks non-admin members from managing identity providers via RBAC', async () => {
    const owner = await authenticateContext(app, prisma, usersRepository, 'member', {
      email: `sso-member-${Date.now()}@example.com`,
    });

    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${owner.organization.id}/identity/providers`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({
        name: 'Should Not Be Allowed',
        protocol: 'SAML',
        samlConfiguration: {
          idpEntityId: 'https://fake-saml-idp.example.com',
          idpSsoUrl: 'https://fake-saml-idp.example.com/sso',
          idpCertificate: 'NOT-A-REAL-CERTIFICATE',
        },
      })
      .expect(403);
  });
});
