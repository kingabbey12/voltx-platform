import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiSuccessResponse } from '../src/common/interceptors/response.interceptor';
import { PrismaService } from '../src/database/prisma.service';
import { UsersRepository } from '../src/modules/users/users.repository';
import { createTestApp } from './create-test-app';
import {
  authenticateContext,
  bearerAuthHeaders,
  resetAndSeedAuthTestData,
} from './helpers/users-test.helper';

interface CompanyHomeResponse {
  organization: { id: string; name: string };
  people: { available: boolean; total: number; items: unknown[] };
  documents: { available: boolean; total: number; items: unknown[] };
  conversations: { available: boolean; total: number; items: unknown[] };
  events: { available: boolean; total: number; items: unknown[] };
  promises: { available: boolean; total: number; items: unknown[] };
  assets: { available: false; reason: string };
}

interface RecordTimelineResponse {
  recordType: string;
  recordId: string;
  createdAt: string;
  updatedAt: string;
  events: { available: boolean; total: number; items: unknown[] };
  conversations: { available: boolean; total: number; items: unknown[] };
  documents: { available: boolean; total: number; items: unknown[] };
  promises: { available: boolean; total: number; items: unknown[] };
  approvals: { available: boolean; total: number; items: unknown[] };
}

describe('Company Workspace (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let usersRepository: UsersRepository;
  let accessToken: string;
  let ownerId: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    usersRepository = app.get(UsersRepository);
  });

  beforeEach(async () => {
    jest.restoreAllMocks();
    await resetAndSeedAuthTestData(prisma);
    const context = await authenticateContext(app, prisma, usersRepository, 'admin');
    accessToken = context.accessToken;
    ownerId = context.user.id;
  });

  afterAll(async () => {
    await resetAndSeedAuthTestData(prisma);
    await app.close();
  });

  it('returns the Company home projection with real, live-queried sections', async () => {
    const companyResponse = await request(app.getHttpServer())
      .post('/api/v1/sales/companies')
      .set(bearerAuthHeaders(accessToken))
      .send({ name: 'Marlin Hospitality', industry: 'Hospitality' })
      .expect(201);
    const company = (companyResponse.body as ApiSuccessResponse<{ id: string }>).data;

    const contactResponse = await request(app.getHttpServer())
      .post('/api/v1/sales/contacts')
      .set(bearerAuthHeaders(accessToken))
      .send({
        companyId: company.id,
        firstName: 'Amara',
        lastName: 'Chidi',
        email: 'amara@marlin.test',
      })
      .expect(201);
    const contact = (contactResponse.body as ApiSuccessResponse<{ id: string }>).data;

    await request(app.getHttpServer())
      .post('/api/v1/promises')
      .set(bearerAuthHeaders(accessToken))
      .send({
        title: 'Marlin expansion',
        ownerId,
        parties: [{ role: 'OBLIGEE', contactId: contact.id }],
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/sales/activities')
      .set(bearerAuthHeaders(accessToken))
      .send({
        companyId: company.id,
        contactId: contact.id,
        type: 'NOTE',
        subject: 'Kickoff call notes',
      })
      .expect(201);

    const homeResponse = await request(app.getHttpServer())
      .get('/api/v1/company/home')
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    const home = (homeResponse.body as ApiSuccessResponse<CompanyHomeResponse>).data;

    expect(home.organization.name).toBeTruthy();
    expect(home.people.available).toBe(true);
    expect(home.people.total).toBeGreaterThanOrEqual(1);
    expect(home.events.available).toBe(true);
    expect(
      home.events.items.some(
        (item) => (item as { subject: string }).subject === 'Kickoff call notes',
      ),
    ).toBe(true);
    expect(home.promises.available).toBe(true);
    expect(
      home.promises.items.some((item) => (item as { title: string }).title === 'Marlin expansion'),
    ).toBe(true);
    // Assets has no backing model yet — a real placeholder, not fabricated data.
    expect(home.assets.available).toBe(false);
    expect(home.assets.reason).toBeTruthy();
  });

  it("aggregates a company record's timeline: created, updated, related events and promises", async () => {
    const companyResponse = await request(app.getHttpServer())
      .post('/api/v1/sales/companies')
      .set(bearerAuthHeaders(accessToken))
      .send({ name: 'Dele Provisions', industry: 'Retail' })
      .expect(201);
    const company = (companyResponse.body as ApiSuccessResponse<{ id: string }>).data;

    const contactResponse = await request(app.getHttpServer())
      .post('/api/v1/sales/contacts')
      .set(bearerAuthHeaders(accessToken))
      .send({ companyId: company.id, firstName: 'Dele', lastName: 'Adeyemi' })
      .expect(201);
    const contact = (contactResponse.body as ApiSuccessResponse<{ id: string }>).data;

    await request(app.getHttpServer())
      .post('/api/v1/promises')
      .set(bearerAuthHeaders(accessToken))
      .send({
        title: 'Reorder contract',
        ownerId,
        parties: [{ role: 'OBLIGEE', contactId: contact.id }],
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/sales/activities')
      .set(bearerAuthHeaders(accessToken))
      .send({ companyId: company.id, type: 'CALL', subject: 'Reorder check-in' })
      .expect(201);

    const timelineResponse = await request(app.getHttpServer())
      .get(`/api/v1/company/timeline/sales.company/${company.id}`)
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    const timeline = (timelineResponse.body as ApiSuccessResponse<RecordTimelineResponse>).data;

    expect(timeline.recordType).toBe('sales.company');
    expect(timeline.recordId).toBe(company.id);
    expect(new Date(timeline.createdAt).getTime()).not.toBeNaN();
    expect(
      timeline.events.items.some(
        (item) => (item as { subject: string }).subject === 'Reorder check-in',
      ),
    ).toBe(true);
    expect(
      timeline.promises.items.some(
        (item) => (item as { title: string }).title === 'Reorder contract',
      ),
    ).toBe(true);
  });

  it('rejects a timeline lookup for a record type that has not been wired up', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/company/timeline/sales.opportunity/00000000-0000-0000-0000-000000000000')
      .set(bearerAuthHeaders(accessToken))
      .expect(400);
  });

  it("aggregates a promise's own timeline: creation, status changes, and approval history", async () => {
    const contactResponse = await request(app.getHttpServer())
      .post('/api/v1/sales/contacts')
      .set(bearerAuthHeaders(accessToken))
      .send({ firstName: 'Amara', lastName: 'Chidi' })
      .expect(201);
    const contact = (contactResponse.body as ApiSuccessResponse<{ id: string }>).data;

    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/promises')
      .set(bearerAuthHeaders(accessToken))
      .send({
        title: 'Standing reorder',
        ownerId,
        parties: [{ role: 'OBLIGEE', contactId: contact.id }],
      })
      .expect(201);
    const promise = (createResponse.body as ApiSuccessResponse<{ id: string; status: string }>)
      .data;
    expect(promise.status).toBe('PROPOSED');

    await request(app.getHttpServer())
      .post(`/api/v1/promises/${promise.id}/stand`)
      .set(bearerAuthHeaders(accessToken))
      .send({ note: 'Confirmed on the call' })
      .expect(201);

    const timelineResponse = await request(app.getHttpServer())
      .get(`/api/v1/company/timeline/promise/${promise.id}`)
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    const timeline = (timelineResponse.body as ApiSuccessResponse<RecordTimelineResponse>).data;

    expect(timeline.recordType).toBe('promise');
    expect(timeline.events.available).toBe(true);
    expect(timeline.events.items).toHaveLength(2);
    expect(
      (timeline.events.items as Array<{ subject: string }>).some(
        (e) => e.subject === 'Promise created',
      ),
    ).toBe(true);
    expect(
      (timeline.events.items as Array<{ subject: string }>).some((e) =>
        e.subject.includes('PROPOSED → STANDING'),
      ),
    ).toBe(true);
    // No approval was ever requested for this promise — a direct human
    // action through the REST API needs no AgentActionApproval at all.
    expect(timeline.approvals.available).toBe(true);
    expect(timeline.approvals.items).toHaveLength(0);
  });

  it('opens a door onto a promise via the record resolver', async () => {
    const contactResponse = await request(app.getHttpServer())
      .post('/api/v1/sales/contacts')
      .set(bearerAuthHeaders(accessToken))
      .send({ firstName: 'Amara', lastName: 'Chidi' })
      .expect(201);
    const contact = (contactResponse.body as ApiSuccessResponse<{ id: string }>).data;

    const createResponse = await request(app.getHttpServer())
      .post('/api/v1/promises')
      .set(bearerAuthHeaders(accessToken))
      .send({
        title: 'Standing reorder',
        ownerId,
        parties: [{ role: 'OBLIGEE', contactId: contact.id }],
      })
      .expect(201);
    const promise = (createResponse.body as ApiSuccessResponse<{ id: string }>).data;

    const doorResponse = await request(app.getHttpServer())
      .get(`/api/v1/ai/ask/records/promise/${promise.id}`)
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    const door = (doorResponse.body as ApiSuccessResponse<{ label: string; route: string | null }>)
      .data;

    expect(door.label).toBe('Standing reorder');
    expect(door.route).toBe(`/promises/${promise.id}`);
  });

  it('lets Ask open a door onto the Company itself via the organization record type', async () => {
    const homeResponse = await request(app.getHttpServer())
      .get('/api/v1/company/home')
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    const home = (homeResponse.body as ApiSuccessResponse<CompanyHomeResponse>).data;

    const doorResponse = await request(app.getHttpServer())
      .get(`/api/v1/ai/ask/records/organization/${home.organization.id}`)
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    const door = (doorResponse.body as ApiSuccessResponse<{ label: string; route: string | null }>)
      .data;

    expect(door.label).toBe(home.organization.name);
    expect(door.route).toBe('/company');
  });
});
