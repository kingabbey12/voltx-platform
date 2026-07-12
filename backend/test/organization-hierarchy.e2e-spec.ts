import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiSuccessResponse } from '../src/common/interceptors/response.interceptor';
import { PrismaService } from '../src/database/prisma.service';
import { UsersRepository } from '../src/modules/users/users.repository';
import { createTestApp } from './create-test-app';
import { authenticateContext, resetAndSeedAuthTestData } from './helpers/users-test.helper';

interface BusinessUnitResponse {
  id: string;
  name: string;
  parentBusinessUnitId: string | null;
}

interface ErrorResponseBody {
  success: false;
  error: { code: string; message: string };
}

interface OrganizationHierarchyResponse {
  organization: { id: string; subsidiaryCount: number };
  parent: { id: string } | null;
  subsidiaries: { id: string }[];
}

interface OrganizationSummaryResponse {
  id: string;
}

describe('Enterprise Organization Hierarchy (e2e)', () => {
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

  it('creates a business unit hierarchy and rejects a cyclic parent reassignment', async () => {
    const owner = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `hierarchy-cycle-${Date.now()}@example.com`,
    });

    const parentResponse = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${owner.organization.id}/structure/business-units`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Engineering' })
      .expect(201);
    const parent = (parentResponse.body as ApiSuccessResponse<BusinessUnitResponse>).data;

    const childResponse = await request(app.getHttpServer())
      .post(`/api/v1/organizations/${owner.organization.id}/structure/business-units`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ name: 'Platform Team', parentBusinessUnitId: parent.id })
      .expect(201);
    const child = (childResponse.body as ApiSuccessResponse<BusinessUnitResponse>).data;

    // Attempting to make the parent a child of its own child must be rejected.
    const cycleResponse = await request(app.getHttpServer())
      .patch(`/api/v1/organizations/${owner.organization.id}/structure/business-units/${parent.id}`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .send({ parentBusinessUnitId: child.id })
      .expect(400);
    expect((cycleResponse.body as ErrorResponseBody).success).toBe(false);
  });

  it('non-admin members cannot manage the organization structure (RBAC)', async () => {
    const member = await authenticateContext(app, prisma, usersRepository, 'member', {
      email: `hierarchy-member-${Date.now()}@example.com`,
    });

    await request(app.getHttpServer())
      .post(`/api/v1/organizations/${member.organization.id}/structure/departments`)
      .set('Authorization', `Bearer ${member.accessToken}`)
      .send({ name: 'Should not be allowed' })
      .expect(403);
  });

  it('rejects normal (non-platform-admin) access to the platform hierarchy/reporting endpoints', async () => {
    const owner = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `hierarchy-non-admin-${Date.now()}@example.com`,
    });

    await request(app.getHttpServer())
      .get(`/api/v1/platform/organizations/${owner.organization.id}/hierarchy`)
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .get('/api/v1/platform/reporting/cross-org')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .expect(403);
  });

  it(
    "the load-bearing regression: a subsidiary's own admin can never see parent/sibling " +
      'data through any normal (non-platform-admin) route, even once parentOrganizationId is set',
    async () => {
      const parentOwner = await authenticateContext(app, prisma, usersRepository, 'admin', {
        email: `hierarchy-parent-owner-${Date.now()}@example.com`,
      });
      const subsidiaryOwner = await authenticateContext(app, prisma, usersRepository, 'admin', {
        email: `hierarchy-subsidiary-owner-${Date.now()}@example.com`,
      });
      const siblingOwner = await authenticateContext(app, prisma, usersRepository, 'admin', {
        email: `hierarchy-sibling-owner-${Date.now()}@example.com`,
      });

      // Tag both as subsidiaries of the parent org directly via Prisma —
      // there is deliberately no normal-auth endpoint that can set this
      // (it's platform-admin-only metadata), so the e2e setup pokes the DB.
      await prisma.system.organization.update({
        where: { id: subsidiaryOwner.organization.id },
        data: { parentOrganizationId: parentOwner.organization.id },
      });
      await prisma.system.organization.update({
        where: { id: siblingOwner.organization.id },
        data: { parentOrganizationId: parentOwner.organization.id },
      });

      // Create org-scoped data in the parent and sibling orgs.
      await request(app.getHttpServer())
        .post(`/api/v1/organizations/${parentOwner.organization.id}/structure/departments`)
        .set('Authorization', `Bearer ${parentOwner.accessToken}`)
        .send({ name: 'Parent-Only Department' })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/api/v1/organizations/${siblingOwner.organization.id}/structure/departments`)
        .set('Authorization', `Bearer ${siblingOwner.accessToken}`)
        .send({ name: 'Sibling-Only Department' })
        .expect(201);

      // The subsidiary's own admin must never see the parent's or the
      // sibling's departments through the normal structure endpoint —
      // even for its own org, it can only ever see its own org's rows,
      // and it has no path at all to query another org's id.
      const subsidiaryDeptsResponse = await request(app.getHttpServer())
        .get(`/api/v1/organizations/${subsidiaryOwner.organization.id}/structure/departments`)
        .set('Authorization', `Bearer ${subsidiaryOwner.accessToken}`)
        .expect(200);
      const subsidiaryDepts = (
        subsidiaryDeptsResponse.body as ApiSuccessResponse<{ name: string }[]>
      ).data;
      expect(subsidiaryDepts).toEqual([]);

      // Directly attempting to read the parent org's structure using the
      // subsidiary admin's own token must be rejected outright — TenantGuard
      // still enforces the JWT's own org claim on every normal route,
      // proving the hierarchy tag grants no cross-org reach.
      await request(app.getHttpServer())
        .get(`/api/v1/organizations/${parentOwner.organization.id}/structure/departments`)
        .set('Authorization', `Bearer ${subsidiaryOwner.accessToken}`)
        .expect(403);
      await request(app.getHttpServer())
        .get(`/api/v1/organizations/${siblingOwner.organization.id}/structure/departments`)
        .set('Authorization', `Bearer ${subsidiaryOwner.accessToken}`)
        .expect(403);

      // The subsidiary admin also has no access at all to the
      // platform-admin-only hierarchy/reporting endpoints.
      await request(app.getHttpServer())
        .get(`/api/v1/platform/organizations/${parentOwner.organization.id}/hierarchy`)
        .set('Authorization', `Bearer ${subsidiaryOwner.accessToken}`)
        .expect(403);
    },
  );

  it('a platform admin can view organization hierarchy and cross-org reporting for any organization', async () => {
    const parentOwner = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `hierarchy-platform-parent-${Date.now()}@example.com`,
    });
    const subsidiaryOwner = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `hierarchy-platform-subsidiary-${Date.now()}@example.com`,
    });
    const platformAdminAccount = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: `hierarchy-platform-admin-${Date.now()}@example.com`,
    });
    await usersRepository.setPlatformAdmin(platformAdminAccount.user.id, true);

    await prisma.system.organization.update({
      where: { id: subsidiaryOwner.organization.id },
      data: { parentOrganizationId: parentOwner.organization.id },
    });

    const hierarchyResponse = await request(app.getHttpServer())
      .get(`/api/v1/platform/organizations/${parentOwner.organization.id}/hierarchy`)
      .set('Authorization', `Bearer ${platformAdminAccount.accessToken}`)
      .expect(200);
    const hierarchy = (hierarchyResponse.body as ApiSuccessResponse<OrganizationHierarchyResponse>)
      .data;
    expect(hierarchy.organization.id).toBe(parentOwner.organization.id);
    expect(hierarchy.subsidiaries.map((s) => s.id)).toContain(subsidiaryOwner.organization.id);

    const crossOrgResponse = await request(app.getHttpServer())
      .get('/api/v1/platform/reporting/cross-org')
      .query({ rootOrganizationId: parentOwner.organization.id })
      .set('Authorization', `Bearer ${platformAdminAccount.accessToken}`)
      .expect(200);
    const crossOrg = (crossOrgResponse.body as ApiSuccessResponse<OrganizationSummaryResponse[]>)
      .data;
    expect(crossOrg.map((o) => o.id).sort()).toEqual(
      [parentOwner.organization.id, subsidiaryOwner.organization.id].sort(),
    );
  });
});
