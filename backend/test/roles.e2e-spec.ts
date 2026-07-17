import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiSuccessResponse } from '../src/common/interceptors/response.interceptor';
import { PrismaService } from '../src/database/prisma.service';
import { RoleResponseDto } from '../src/modules/roles/dto/role-response.dto';
import { UsersRepository } from '../src/modules/users/users.repository';
import { createTestApp } from './create-test-app';
import {
  authenticateContext,
  bearerAuthHeaders,
  resetAndSeedAuthTestData,
  seedAuthContext,
} from './helpers/users-test.helper';

describe('RolesController custom roles (e2e)', () => {
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

  it('creates a custom role, lists it alongside system roles, and lets the org use it', async () => {
    const owner = await authenticateContext(app, prisma, usersRepository, 'owner');

    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/roles')
      .set(bearerAuthHeaders(owner.accessToken))
      .send({
        name: 'Sales Manager',
        permissionKeys: ['sales.opportunity.read', 'sales.opportunity.update'],
      })
      .expect(201);

    const created = (createResponse.body as ApiSuccessResponse<RoleResponseDto>).data;
    expect(created.isSystem).toBe(false);
    expect(created.key).toBe('sales-manager');
    expect(created.organizationId).toBe(owner.organization.id);
    expect(created.permissions.sort()).toEqual(
      ['sales.opportunity.read', 'sales.opportunity.update'].sort(),
    );

    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/roles')
      .set(bearerAuthHeaders(owner.accessToken))
      .expect(200);

    const roles = (listResponse.body as ApiSuccessResponse<{ items: RoleResponseDto[] }>).data
      .items;
    expect(roles.some((role) => role.key === 'sales-manager')).toBe(true);
    expect(roles.some((role) => role.key === 'owner' && role.isSystem)).toBe(true);
  });

  it('rejects creating a role with an unknown permission key', async () => {
    const owner = await authenticateContext(app, prisma, usersRepository, 'owner');

    await request(app.getHttpServer())
      .post('/api/v1/roles')
      .set(bearerAuthHeaders(owner.accessToken))
      .send({ name: 'Bogus Role', permissionKeys: ['not.a.real.permission'] })
      .expect(400);
  });

  it('updates and deletes a custom role', async () => {
    const owner = await authenticateContext(app, prisma, usersRepository, 'owner');

    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/roles')
      .set(bearerAuthHeaders(owner.accessToken))
      .send({ name: 'Temp Role', permissionKeys: ['sales.opportunity.read'] })
      .expect(201);
    const roleId = (createResponse.body as ApiSuccessResponse<RoleResponseDto>).data.id;

    const updateResponse = await request(app.getHttpServer())
      .patch(`/api/v1/roles/${roleId}`)
      .set(bearerAuthHeaders(owner.accessToken))
      .send({ name: 'Renamed Role' })
      .expect(200);
    expect((updateResponse.body as ApiSuccessResponse<RoleResponseDto>).data.name).toBe(
      'Renamed Role',
    );

    await request(app.getHttpServer())
      .delete(`/api/v1/roles/${roleId}`)
      .set(bearerAuthHeaders(owner.accessToken))
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/v1/roles/${roleId}`)
      .set(bearerAuthHeaders(owner.accessToken))
      .expect(404);
  });

  it('refuses to modify or delete a system role even for an owner', async () => {
    const owner = await authenticateContext(app, prisma, usersRepository, 'owner');
    const memberRole = await prisma.system.role.findUniqueOrThrow({ where: { key: 'member' } });

    await request(app.getHttpServer())
      .patch(`/api/v1/roles/${memberRole.id}`)
      .set(bearerAuthHeaders(owner.accessToken))
      .send({ name: 'Hacked Member' })
      .expect(403);

    await request(app.getHttpServer())
      .delete(`/api/v1/roles/${memberRole.id}`)
      .set(bearerAuthHeaders(owner.accessToken))
      .expect(403);
  });

  it('refuses to delete a role that still has an active member assigned', async () => {
    const owner = await authenticateContext(app, prisma, usersRepository, 'owner');

    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/roles')
      .set(bearerAuthHeaders(owner.accessToken))
      .send({ name: 'Occupied Role', permissionKeys: ['sales.opportunity.read'] })
      .expect(201);
    const roleId = (createResponse.body as ApiSuccessResponse<RoleResponseDto>).data.id;

    const role = await prisma.system.role.findUniqueOrThrow({ where: { id: roleId } });
    // A second member of the SAME organization, holding the new custom
    // role — seedAuthContext (not authenticateContext, which always
    // creates a brand-new organization) is what lets this membership land
    // in owner.organization rather than a fresh one.
    await seedAuthContext(
      prisma,
      usersRepository,
      role.key,
      { email: 'occupant@example.com' },
      undefined,
      { organizationId: owner.organization.id },
    );

    await request(app.getHttpServer())
      .delete(`/api/v1/roles/${roleId}`)
      .set(bearerAuthHeaders(owner.accessToken))
      .expect(409);
  });

  it("never exposes another organization's custom role", async () => {
    const orgA = await authenticateContext(app, prisma, usersRepository, 'owner');
    const orgB = await authenticateContext(app, prisma, usersRepository, 'owner', {
      email: 'owner-b@example.com',
    });

    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/roles')
      .set(bearerAuthHeaders(orgA.accessToken))
      .send({ name: 'Org A Only Role', permissionKeys: ['sales.opportunity.read'] })
      .expect(201);
    const roleId = (createResponse.body as ApiSuccessResponse<RoleResponseDto>).data.id;

    await request(app.getHttpServer())
      .get(`/api/v1/roles/${roleId}`)
      .set(bearerAuthHeaders(orgB.accessToken))
      .expect(404);

    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/roles')
      .set(bearerAuthHeaders(orgB.accessToken))
      .expect(200);
    const roles = (listResponse.body as ApiSuccessResponse<{ items: RoleResponseDto[] }>).data
      .items;
    expect(roles.some((role) => role.id === roleId)).toBe(false);

    await request(app.getHttpServer())
      .patch(`/api/v1/roles/${roleId}`)
      .set(bearerAuthHeaders(orgB.accessToken))
      .send({ name: 'Stolen' })
      .expect(404);
  });
});
