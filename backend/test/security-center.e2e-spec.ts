import { INestApplication } from '@nestjs/common';
import { authenticator } from 'otplib';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiSuccessResponse } from '../src/common/interceptors/response.interceptor';
import { PrismaService } from '../src/database/prisma.service';
import {
  AuthTokensDto,
  LoginResponseDto,
  MfaChallengeResponseDto,
} from '../src/modules/auth/dto/auth-response.dto';
import { UsersRepository } from '../src/modules/users/users.repository';
import {
  ApiKeyResponseDto,
  CreateApiKeyResponseDto,
} from '../src/modules/security/dto/api-key.dto';
import {
  MfaBackupCodesResponseDto,
  MfaSetupResponseDto,
} from '../src/modules/security/dto/mfa.dto';
import { SecurityPolicyResponseDto } from '../src/modules/security/dto/security-policy.dto';
import { PaginatedSessionsDto, SessionResponseDto } from '../src/modules/security/dto/session.dto';
import { TrustedDeviceResponseDto } from '../src/modules/security/dto/trusted-device.dto';
import { createTestApp } from './create-test-app';
import {
  bearerAuthHeaders,
  loginAs,
  resetAndSeedAuthTestData,
  seedAuthContext,
} from './helpers/users-test.helper';

function isMfaChallenge(
  body: LoginResponseDto | MfaChallengeResponseDto,
): body is MfaChallengeResponseDto {
  return 'mfaRequired' in body;
}

describe('Security Center (e2e)', () => {
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

  describe('MFA enroll → verify → login, and backup codes', () => {
    it('completes TOTP enroll → verify → login, and blocks a second login until the challenge is verified', async () => {
      const { user, organization, password } = await seedAuthContext(
        prisma,
        usersRepository,
        'admin',
      );
      const tokens = await loginAs(app, user.email, password, organization.id);

      const setupResponse = await request(app.getHttpServer())
        .post('/api/v1/security/mfa/setup')
        .set(bearerAuthHeaders(tokens.accessToken))
        .expect(200);
      const setup = (setupResponse.body as ApiSuccessResponse<MfaSetupResponseDto>).data;
      expect(setup.secret).toBeTruthy();

      const validCode = authenticator.generate(setup.secret);
      const verifySetupResponse = await request(app.getHttpServer())
        .post('/api/v1/security/mfa/setup/verify')
        .set(bearerAuthHeaders(tokens.accessToken))
        .send({ code: validCode })
        .expect(200);
      const backupCodes = (
        verifySetupResponse.body as ApiSuccessResponse<MfaBackupCodesResponseDto>
      ).data.backupCodes;
      expect(backupCodes.length).toBeGreaterThan(0);

      // Next login must be challenged, not issue tokens directly.
      const loginResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: user.email, password, organizationId: organization.id })
        .expect(200);
      const loginBody = (
        loginResponse.body as ApiSuccessResponse<LoginResponseDto | MfaChallengeResponseDto>
      ).data;
      expect(isMfaChallenge(loginBody)).toBe(true);
      if (!isMfaChallenge(loginBody)) {
        throw new Error('expected an MFA challenge');
      }
      expect(loginBody.mfaChallengeToken).toBeTruthy();

      // The challenge token alone must not work as a bearer access token.
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${loginBody.mfaChallengeToken}`)
        .expect(401);

      const secondCode = authenticator.generate(setup.secret);
      const verifyLoginResponse = await request(app.getHttpServer())
        .post('/api/v1/security/mfa/verify-login')
        .send({ challengeToken: loginBody.mfaChallengeToken, code: secondCode })
        .expect(200);
      const verifiedSession = (verifyLoginResponse.body as ApiSuccessResponse<LoginResponseDto>)
        .data;
      expect(verifiedSession.accessToken).toBeTruthy();
      expect(verifiedSession.user.id).toBe(user.id);

      // The new access token actually works.
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set(bearerAuthHeaders(verifiedSession.accessToken))
        .expect(200);
    });

    it('rejects a reused/invalid TOTP code at verify-login', async () => {
      const { user, organization, password } = await seedAuthContext(
        prisma,
        usersRepository,
        'admin',
      );
      const tokens = await loginAs(app, user.email, password, organization.id);

      const setupResponse = await request(app.getHttpServer())
        .post('/api/v1/security/mfa/setup')
        .set(bearerAuthHeaders(tokens.accessToken))
        .expect(200);
      const setup = (setupResponse.body as ApiSuccessResponse<MfaSetupResponseDto>).data;
      await request(app.getHttpServer())
        .post('/api/v1/security/mfa/setup/verify')
        .set(bearerAuthHeaders(tokens.accessToken))
        .send({ code: authenticator.generate(setup.secret) })
        .expect(200);

      const loginResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: user.email, password, organizationId: organization.id })
        .expect(200);
      const challenge = (loginResponse.body as ApiSuccessResponse<MfaChallengeResponseDto>).data;

      await request(app.getHttpServer())
        .post('/api/v1/security/mfa/verify-login')
        .send({ challengeToken: challenge.mfaChallengeToken, code: '000000' })
        .expect(401);
    });

    it('enforces single-use backup codes', async () => {
      const { user, organization, password } = await seedAuthContext(
        prisma,
        usersRepository,
        'admin',
      );
      const tokens = await loginAs(app, user.email, password, organization.id);

      const setupResponse = await request(app.getHttpServer())
        .post('/api/v1/security/mfa/setup')
        .set(bearerAuthHeaders(tokens.accessToken))
        .expect(200);
      const setup = (setupResponse.body as ApiSuccessResponse<MfaSetupResponseDto>).data;
      const verifySetupResponse = await request(app.getHttpServer())
        .post('/api/v1/security/mfa/setup/verify')
        .set(bearerAuthHeaders(tokens.accessToken))
        .send({ code: authenticator.generate(setup.secret) })
        .expect(200);
      const [backupCode] = (
        verifySetupResponse.body as ApiSuccessResponse<MfaBackupCodesResponseDto>
      ).data.backupCodes;

      const firstLogin = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: user.email, password, organizationId: organization.id })
        .expect(200);
      const firstChallenge = (firstLogin.body as ApiSuccessResponse<MfaChallengeResponseDto>).data;

      // First use of the backup code succeeds.
      await request(app.getHttpServer())
        .post('/api/v1/security/mfa/verify-login')
        .send({ challengeToken: firstChallenge.mfaChallengeToken, code: backupCode })
        .expect(200);

      // A fresh challenge, but the SAME backup code must now be rejected.
      const secondLogin = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: user.email, password, organizationId: organization.id })
        .expect(200);
      const secondChallenge = (secondLogin.body as ApiSuccessResponse<MfaChallengeResponseDto>)
        .data;

      await request(app.getHttpServer())
        .post('/api/v1/security/mfa/verify-login')
        .send({ challengeToken: secondChallenge.mfaChallengeToken, code: backupCode })
        .expect(401);
    });
  });

  describe('org-required MFA blocks login until the user enrolls', () => {
    it('returns 403 rather than silently allowing login when the org requires MFA and the user has not enrolled', async () => {
      const { user, organization, password } = await seedAuthContext(
        prisma,
        usersRepository,
        'admin',
      );
      const owner = await loginAs(app, user.email, password, organization.id);

      await request(app.getHttpServer())
        .patch(`/api/v1/organizations/${organization.id}/security-policy`)
        .set(bearerAuthHeaders(owner.accessToken))
        .send({ mfaRequired: true })
        .expect(200);

      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: user.email, password, organizationId: organization.id })
        .expect(403);
    });
  });

  describe('sessions: revoke cascades to refresh-token rejection', () => {
    it('rejects the refresh token of a session after it is revoked', async () => {
      const { user, organization, password } = await seedAuthContext(
        prisma,
        usersRepository,
        'admin',
      );
      const tokens = await loginAs(app, user.email, password, organization.id);

      // A brand-new org/user has exactly one session after one login.
      const listResponse = await request(app.getHttpServer())
        .get('/api/v1/security/sessions')
        .set(bearerAuthHeaders(tokens.accessToken))
        .expect(200);
      const sessions = (listResponse.body as ApiSuccessResponse<SessionResponseDto[]>).data;
      expect(sessions).toHaveLength(1);
      const [session] = sessions;

      // Rotation must carry the SAME session forward, not create a new one.
      const refreshResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: tokens.refreshToken })
        .expect(200);
      const rotatedTokens = (refreshResponse.body as ApiSuccessResponse<AuthTokensDto>).data;

      const sessionsAfterRotation = (
        (
          await request(app.getHttpServer())
            .get('/api/v1/security/sessions')
            .set(bearerAuthHeaders(rotatedTokens.accessToken))
            .expect(200)
        ).body as ApiSuccessResponse<SessionResponseDto[]>
      ).data;
      expect(sessionsAfterRotation).toHaveLength(1);
      expect(sessionsAfterRotation[0].id).toBe(session.id);

      // Revoking the (still the same) session must reject the ROTATED
      // refresh token — proving the cascade survives rotation.
      await request(app.getHttpServer())
        .delete(`/api/v1/security/sessions/${session.id}`)
        .set(bearerAuthHeaders(rotatedTokens.accessToken))
        .expect(200);

      await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: rotatedTokens.refreshToken })
        .expect(401);
    });

    it('login-history includes both active and revoked sessions', async () => {
      const { user, organization, password } = await seedAuthContext(
        prisma,
        usersRepository,
        'admin',
      );
      const tokens = await loginAs(app, user.email, password, organization.id);

      const historyResponse = await request(app.getHttpServer())
        .get('/api/v1/security/login-history')
        .set(bearerAuthHeaders(tokens.accessToken))
        .expect(200);
      const history = (historyResponse.body as ApiSuccessResponse<PaginatedSessionsDto>).data;
      expect(history.total).toBeGreaterThan(0);
    });
  });

  describe('trusted-device MFA-skip window', () => {
    it('skips the MFA challenge for a device trusted during a previous verify-login', async () => {
      const { user, organization, password } = await seedAuthContext(
        prisma,
        usersRepository,
        'admin',
      );
      const tokens = await loginAs(app, user.email, password, organization.id);

      const setupResponse = await request(app.getHttpServer())
        .post('/api/v1/security/mfa/setup')
        .set(bearerAuthHeaders(tokens.accessToken))
        .expect(200);
      const setup = (setupResponse.body as ApiSuccessResponse<MfaSetupResponseDto>).data;
      await request(app.getHttpServer())
        .post('/api/v1/security/mfa/setup/verify')
        .set(bearerAuthHeaders(tokens.accessToken))
        .send({ code: authenticator.generate(setup.secret) })
        .expect(200);

      const deviceFingerprint = 'e2e-trusted-device-1';
      const loginResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: user.email, password, organizationId: organization.id, deviceFingerprint })
        .expect(200);
      const challenge = (loginResponse.body as ApiSuccessResponse<MfaChallengeResponseDto>).data;

      await request(app.getHttpServer())
        .post('/api/v1/security/mfa/verify-login')
        .send({
          challengeToken: challenge.mfaChallengeToken,
          code: authenticator.generate(setup.secret),
          deviceFingerprint,
          trustDevice: true,
          trustedForDays: 30,
        })
        .expect(200);

      // Same device on the next login: no challenge this time.
      const secondLoginResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({ email: user.email, password, organizationId: organization.id, deviceFingerprint })
        .expect(200);
      const secondLoginBody = (
        secondLoginResponse.body as ApiSuccessResponse<LoginResponseDto | MfaChallengeResponseDto>
      ).data;
      expect(isMfaChallenge(secondLoginBody)).toBe(false);

      // A DIFFERENT, never-trusted device on the same account is still challenged.
      const thirdLoginResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: user.email,
          password,
          organizationId: organization.id,
          deviceFingerprint: 'e2e-untrusted-device',
        })
        .expect(200);
      const thirdLoginBody = (
        thirdLoginResponse.body as ApiSuccessResponse<LoginResponseDto | MfaChallengeResponseDto>
      ).data;
      expect(isMfaChallenge(thirdLoginBody)).toBe(true);
    });
  });

  describe('IP allowlist', () => {
    it('allows requests once the resolved client IP is added to the allowlist, and blocks others', async () => {
      const { user, organization, password } = await seedAuthContext(
        prisma,
        usersRepository,
        'admin',
      );
      const tokens = await loginAs(app, user.email, password, organization.id);

      // A restrictive allowlist that excludes the loopback address supertest
      // connects from must block the (IP-guarded) API key endpoints.
      await request(app.getHttpServer())
        .patch(`/api/v1/organizations/${organization.id}/security-policy`)
        .set(bearerAuthHeaders(tokens.accessToken))
        .send({ ipAllowlist: ['203.0.113.7'] })
        .expect(200);

      await request(app.getHttpServer())
        .get('/api/v1/security/api-keys')
        .set(bearerAuthHeaders(tokens.accessToken))
        .expect(403);

      // TRUSTED_PROXY_COUNT is 0 in test config, so a forged X-Forwarded-For
      // claiming to be an allowlisted IP must NOT bypass the restriction —
      // Express ignores that header entirely without `trust proxy` set.
      await request(app.getHttpServer())
        .get('/api/v1/security/api-keys')
        .set(bearerAuthHeaders(tokens.accessToken))
        .set('X-Forwarded-For', '203.0.113.7')
        .expect(403);

      // Clearing the allowlist restores access.
      await request(app.getHttpServer())
        .patch(`/api/v1/organizations/${organization.id}/security-policy`)
        .set(bearerAuthHeaders(tokens.accessToken))
        .send({ ipAllowlist: [] })
        .expect(200);

      await request(app.getHttpServer())
        .get('/api/v1/security/api-keys')
        .set(bearerAuthHeaders(tokens.accessToken))
        .expect(200);
    });
  });

  describe('API keys as a JWT alternative, with scoped permissions', () => {
    it('rejects creating a key scoped to a permission the caller does not hold', async () => {
      const { organization, user, password } = await seedAuthContext(
        prisma,
        usersRepository,
        'viewer',
      );
      const tokens = await loginAs(app, user.email, password, organization.id);

      await request(app.getHttpServer())
        .post('/api/v1/security/api-keys')
        .set(bearerAuthHeaders(tokens.accessToken))
        .send({ name: 'Escalation attempt', scopedPermissions: ['organization.delete'] })
        .expect(403);
    });

    it('authenticates via X-Api-Key (no JWT/membership at all) and resolves only the scoped permissions', async () => {
      const { organization, user, password } = await seedAuthContext(
        prisma,
        usersRepository,
        'admin',
      );
      const tokens = await loginAs(app, user.email, password, organization.id);

      const createResponse = await request(app.getHttpServer())
        .post('/api/v1/security/api-keys')
        .set(bearerAuthHeaders(tokens.accessToken))
        .send({ name: 'CI bot', scopedPermissions: ['organization.read'] })
        .expect(201);
      const created = (createResponse.body as ApiSuccessResponse<CreateApiKeyResponseDto>).data;
      expect(created.apiKey).toBeTruthy();

      // A garbage key is rejected outright — no JWT/Membership resolution is
      // ever attempted for this route, only the key itself.
      await request(app.getHttpServer())
        .get('/api/v1/security/api-keys/whoami')
        .set('X-Api-Key', 'not-a-real-key')
        .expect(401);
      // No key at all is likewise rejected (never silently falls through).
      await request(app.getHttpServer()).get('/api/v1/security/api-keys/whoami').expect(401);

      const whoamiResponse = await request(app.getHttpServer())
        .get('/api/v1/security/api-keys/whoami')
        .set('X-Api-Key', created.apiKey)
        .expect(200);
      const whoami = (
        whoamiResponse.body as ApiSuccessResponse<{ organizationId: string; permissions: string[] }>
      ).data;
      expect(whoami.organizationId).toBe(organization.id);
      // Exactly the scoped permissions — never the full admin role's set.
      expect(whoami.permissions).toEqual(['organization.read']);

      const listResponse = await request(app.getHttpServer())
        .get('/api/v1/security/api-keys')
        .set(bearerAuthHeaders(tokens.accessToken))
        .expect(200);
      const keys = (listResponse.body as ApiSuccessResponse<ApiKeyResponseDto[]>).data;
      expect(keys.some((key) => key.id === created.id)).toBe(true);

      await request(app.getHttpServer())
        .delete(`/api/v1/security/api-keys/${created.id}`)
        .set(bearerAuthHeaders(tokens.accessToken))
        .expect(200);

      // Revoked keys are rejected immediately.
      await request(app.getHttpServer())
        .get('/api/v1/security/api-keys/whoami')
        .set('X-Api-Key', created.apiKey)
        .expect(401);
    });
  });

  describe('cross-tenant isolation', () => {
    it("org A cannot see, revoke, or reconfigure org B's sessions, trusted devices, API keys, or security policy", async () => {
      const orgA = await seedAuthContext(prisma, usersRepository, 'admin', {
        email: `org-a-owner-${Date.now()}@example.com`,
      });
      const orgB = await seedAuthContext(prisma, usersRepository, 'admin', {
        email: `org-b-owner-${Date.now()}@example.com`,
      });

      const tokensA = await loginAs(app, orgA.user.email, orgA.password, orgA.organization.id);
      const tokensB = await loginAs(app, orgB.user.email, orgB.password, orgB.organization.id);

      // Org B's own security-policy endpoint, called with org A's token —
      // TenantGuard's JWT-derived org must win regardless of the :id param.
      await request(app.getHttpServer())
        .get(`/api/v1/organizations/${orgB.organization.id}/security-policy`)
        .set(bearerAuthHeaders(tokensA.accessToken))
        .expect(403);

      // Org B creates an API key; org A must never see or be able to revoke it.
      const orgBKeyResponse = await request(app.getHttpServer())
        .post('/api/v1/security/api-keys')
        .set(bearerAuthHeaders(tokensB.accessToken))
        .send({ name: 'Org B key', scopedPermissions: ['organization.read'] })
        .expect(201);
      const orgBKey = (orgBKeyResponse.body as ApiSuccessResponse<CreateApiKeyResponseDto>).data;

      const orgAKeysResponse = await request(app.getHttpServer())
        .get('/api/v1/security/api-keys')
        .set(bearerAuthHeaders(tokensA.accessToken))
        .expect(200);
      const orgAKeys = (orgAKeysResponse.body as ApiSuccessResponse<ApiKeyResponseDto[]>).data;
      expect(orgAKeys.some((key) => key.id === orgBKey.id)).toBe(false);

      await request(app.getHttpServer())
        .delete(`/api/v1/security/api-keys/${orgBKey.id}`)
        .set(bearerAuthHeaders(tokensA.accessToken))
        .expect(404);

      // Org A must never see org B's sessions.
      const orgASessionsResponse = await request(app.getHttpServer())
        .get('/api/v1/security/sessions')
        .set(bearerAuthHeaders(tokensA.accessToken))
        .expect(200);
      const orgASessions = (orgASessionsResponse.body as ApiSuccessResponse<SessionResponseDto[]>)
        .data;

      const orgBSessionsResponse = await request(app.getHttpServer())
        .get('/api/v1/security/sessions')
        .set(bearerAuthHeaders(tokensB.accessToken))
        .expect(200);
      const orgBSessions = (orgBSessionsResponse.body as ApiSuccessResponse<SessionResponseDto[]>)
        .data;

      expect(orgBSessions.some((s) => orgASessions.some((a) => a.id === s.id))).toBe(false);
      // Org A cannot revoke a session it doesn't own (404, not leaked details).
      await request(app.getHttpServer())
        .delete(`/api/v1/security/sessions/${orgBSessions[0].id}`)
        .set(bearerAuthHeaders(tokensA.accessToken))
        .expect(404);

      // Trusted devices are similarly isolated.
      const trustResponse = await request(app.getHttpServer())
        .post('/api/v1/security/trusted-devices')
        .set(bearerAuthHeaders(tokensB.accessToken))
        .send({ deviceFingerprint: 'org-b-device' })
        .expect(201);
      const orgBDevice = (trustResponse.body as ApiSuccessResponse<TrustedDeviceResponseDto>).data;

      const orgADevicesResponse = await request(app.getHttpServer())
        .get('/api/v1/security/trusted-devices')
        .set(bearerAuthHeaders(tokensA.accessToken))
        .expect(200);
      const orgADevices = (
        orgADevicesResponse.body as ApiSuccessResponse<TrustedDeviceResponseDto[]>
      ).data;
      expect(orgADevices.some((d) => d.id === orgBDevice.id)).toBe(false);

      await request(app.getHttpServer())
        .delete(`/api/v1/security/trusted-devices/${orgBDevice.id}`)
        .set(bearerAuthHeaders(tokensA.accessToken))
        .expect(404);
    });
  });

  describe('security policy CRUD', () => {
    it('reads default policy and persists a partial update without clobbering unrelated org settings', async () => {
      const { user, organization, password } = await seedAuthContext(
        prisma,
        usersRepository,
        'admin',
      );
      const tokens = await loginAs(app, user.email, password, organization.id);

      const getResponse = await request(app.getHttpServer())
        .get(`/api/v1/organizations/${organization.id}/security-policy`)
        .set(bearerAuthHeaders(tokens.accessToken))
        .expect(200);
      const defaultPolicy = (getResponse.body as ApiSuccessResponse<SecurityPolicyResponseDto>)
        .data;
      expect(defaultPolicy.mfaRequired).toBe(false);
      expect(defaultPolicy.ipAllowlist).toEqual([]);

      await request(app.getHttpServer())
        .patch(`/api/v1/organizations/${organization.id}`)
        .set(bearerAuthHeaders(tokens.accessToken))
        .send({ name: 'Renamed Org' })
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/api/v1/organizations/${organization.id}/security-policy`)
        .set(bearerAuthHeaders(tokens.accessToken))
        .send({ passwordPolicy: { minLength: 12 } })
        .expect(200);

      const orgResponse = await request(app.getHttpServer())
        .get(`/api/v1/organizations/${organization.id}`)
        .set(bearerAuthHeaders(tokens.accessToken))
        .expect(200);
      const orgBody = (orgResponse.body as ApiSuccessResponse<{ name: string }>).data;
      expect(orgBody.name).toBe('Renamed Org');

      const finalPolicyResponse = await request(app.getHttpServer())
        .get(`/api/v1/organizations/${organization.id}/security-policy`)
        .set(bearerAuthHeaders(tokens.accessToken))
        .expect(200);
      const finalPolicy = (
        finalPolicyResponse.body as ApiSuccessResponse<SecurityPolicyResponseDto>
      ).data;
      expect(finalPolicy.passwordPolicy.minLength).toBe(12);
    });
  });
});
