import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiSuccessResponse } from '../src/common/interceptors/response.interceptor';
import { PrismaService } from '../src/database/prisma.service';
import { AgentService } from '../src/modules/ai/agents/agent.service';
import { UsersRepository } from '../src/modules/users/users.repository';
import { createTestApp } from './create-test-app';
import {
  authenticateContext,
  bearerAuthHeaders,
  resetAndSeedAuthTestData,
} from './helpers/users-test.helper';

describe('Sales Copilot (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let usersRepository: UsersRepository;
  let agentService: AgentService;
  let accessToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    usersRepository = app.get(UsersRepository);
    agentService = app.get(AgentService);
  });

  beforeEach(async () => {
    jest.restoreAllMocks();
    await resetAndSeedAuthTestData(prisma);
    accessToken = (await authenticateContext(app, prisma, usersRepository, 'admin')).accessToken;
  });

  afterAll(async () => {
    await resetAndSeedAuthTestData(prisma);
    await app.close();
  });

  it('creates and lists sales entities', async () => {
    const companyResponse = await request(app.getHttpServer())
      .post('/api/v1/sales/companies')
      .set(bearerAuthHeaders(accessToken))
      .send({
        name: 'Acme Energy',
        industry: 'Energy',
      })
      .expect(201);

    const company = (companyResponse.body as ApiSuccessResponse<{ id: string }>).data;

    const contactResponse = await request(app.getHttpServer())
      .post('/api/v1/sales/contacts')
      .set(bearerAuthHeaders(accessToken))
      .send({
        companyId: company.id,
        firstName: 'Taylor',
        lastName: 'Morgan',
        email: 'taylor@acme.energy',
      })
      .expect(201);

    const contact = (contactResponse.body as ApiSuccessResponse<{ id: string }>).data;

    const leadResponse = await request(app.getHttpServer())
      .post('/api/v1/sales/leads')
      .set(bearerAuthHeaders(accessToken))
      .send({
        companyId: company.id,
        contactId: contact.id,
        title: 'Acme Energy expansion',
        source: 'Inbound demo',
      })
      .expect(201);

    const lead = (leadResponse.body as ApiSuccessResponse<{ id: string }>).data;

    await request(app.getHttpServer())
      .post('/api/v1/sales/opportunities')
      .set(bearerAuthHeaders(accessToken))
      .send({
        companyId: company.id,
        contactId: contact.id,
        leadId: lead.id,
        title: 'EMEA rollout',
        stage: 'DISCOVERY',
        amount: 125000,
        probability: 50,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/sales/activities')
      .set(bearerAuthHeaders(accessToken))
      .send({
        companyId: company.id,
        contactId: contact.id,
        leadId: lead.id,
        type: 'MEETING',
        subject: 'Discovery call',
        completed: true,
      })
      .expect(201);

    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/sales/leads')
      .set(bearerAuthHeaders(accessToken))
      .expect(200);

    const listBody = listResponse.body as ApiSuccessResponse<{
      items: Array<{ id: string; title: string }>;
      total: number;
    }>;
    expect(listBody.data.total).toBe(1);
    expect(listBody.data.items[0]?.title).toBe('Acme Energy expansion');
  });

  it('runs AI lead qualification and persists the generated summary', async () => {
    jest.spyOn(agentService, 'findAgentByName').mockResolvedValue({
      id: 'agent-1',
      organizationId: 'org-1',
      name: 'Sales Assistant',
      description: 'Built-in',
      systemPrompt: 'You are a sales assistant.',
      provider: 'openai',
      model: 'gpt-5-mini',
      configuration: {},
      enabled: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
    jest.spyOn(agentService, 'runAgent').mockResolvedValue({
      run: { id: 'run-1' } as never,
      assistantMessage: {
        id: 'message-1',
        conversationId: 'conversation-1',
        role: 'assistant',
        content: 'High fit lead with budget, urgency, and an active champion.',
        metadata: {},
        tokenUsage: {},
        createdAt: new Date().toISOString(),
      },
      toolMessages: [],
    } as never);

    const leadResponse = await request(app.getHttpServer())
      .post('/api/v1/sales/leads')
      .set(bearerAuthHeaders(accessToken))
      .send({
        title: 'Large enterprise procurement modernization',
        source: 'Conference follow-up',
      })
      .expect(201);

    const lead = (leadResponse.body as ApiSuccessResponse<{ id: string }>).data;

    const qualifyResponse = await request(app.getHttpServer())
      .post(`/api/v1/sales/leads/${lead.id}/qualify`)
      .set(bearerAuthHeaders(accessToken))
      .send({})
      .expect(201);

    const qualifyBody = qualifyResponse.body as ApiSuccessResponse<{ outputText: string }>;
    expect(qualifyBody.data.outputText).toContain('High fit lead');

    const refreshedResponse = await request(app.getHttpServer())
      .get(`/api/v1/sales/leads/${lead.id}`)
      .set(bearerAuthHeaders(accessToken))
      .expect(200);

    const refreshedLead = (
      refreshedResponse.body as ApiSuccessResponse<{
        qualificationSummary: string | null;
        qualificationScore: number | null;
        status: string;
      }>
    ).data;
    expect(refreshedLead.qualificationSummary).toContain('High fit lead');
    expect(refreshedLead.qualificationScore).toBeGreaterThanOrEqual(70);
    expect(refreshedLead.status).toBe('QUALIFIED');
  });
});
