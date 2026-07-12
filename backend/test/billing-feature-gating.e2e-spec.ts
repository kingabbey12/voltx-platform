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
