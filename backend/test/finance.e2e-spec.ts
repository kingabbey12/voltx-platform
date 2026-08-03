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

describe('Finance (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let usersRepository: UsersRepository;
  let accessToken: string;

  beforeAll(async () => {
    app = await createTestApp();
    prisma = app.get(PrismaService);
    usersRepository = app.get(UsersRepository);
  });

  beforeEach(async () => {
    await resetAndSeedAuthTestData(prisma);
    accessToken = (await authenticateContext(app, prisma, usersRepository, 'admin')).accessToken;
  });

  afterAll(async () => {
    await resetAndSeedAuthTestData(prisma);
    await app.close();
  });

  it('records financial activity, produces an overview, and writes audit entries', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/finance/budgets')
      .set(bearerAuthHeaders(accessToken))
      .send({
        name: 'August operations',
        amount: 1000,
        currency: 'USD',
        periodStart: '2026-08-01',
        periodEnd: '2026-08-31',
      })
      .expect(201);

    const incomeResponse = await request(app.getHttpServer())
      .post('/api/v1/finance/transactions')
      .set(bearerAuthHeaders(accessToken))
      .send({
        type: 'INCOME',
        category: 'Services',
        counterpartyName: 'Acme Energy',
        amount: 3000,
        currency: 'USD',
        occurredAt: '2026-08-02T12:00:00.000Z',
      })
      .expect(201);
    const income = (incomeResponse.body as ApiSuccessResponse<{ id: string }>).data;

    await request(app.getHttpServer())
      .post('/api/v1/finance/transactions')
      .set(bearerAuthHeaders(accessToken))
      .send({
        type: 'EXPENSE',
        category: 'Software',
        amount: 250,
        currency: 'USD',
        occurredAt: '2026-08-02T12:00:00.000Z',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/v1/finance/transactions')
      .set(bearerAuthHeaders(accessToken))
      .send({
        type: 'EXPENSE',
        status: 'PENDING',
        category: 'Travel',
        amount: 75,
        currency: 'USD',
        occurredAt: '2026-08-02T12:00:00.000Z',
      })
      .expect(201);

    const overviewResponse = await request(app.getHttpServer())
      .get('/api/v1/finance/overview?from=2026-08-01&to=2026-08-31')
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    const overview = (
      overviewResponse.body as ApiSuccessResponse<{
        income: number;
        expenses: number;
        netCashFlow: number;
        pendingExpenses: number;
        budgetedExpenses: number;
        budgetVariance: number;
      }>
    ).data;
    expect(overview).toEqual(
      expect.objectContaining({
        income: 3000,
        expenses: 250,
        netCashFlow: 2750,
        pendingExpenses: 75,
        budgetedExpenses: 1000,
        budgetVariance: 750,
      }),
    );

    const listResponse = await request(app.getHttpServer())
      .get('/api/v1/finance/transactions')
      .set(bearerAuthHeaders(accessToken))
      .expect(200);
    expect((listResponse.body as ApiSuccessResponse<{ total: number }>).data.total).toBe(3);

    const audit = await prisma.system.auditLog.findFirst({
      where: { resource: 'financial_transaction', resourceId: income.id, action: 'create' },
    });
    expect(audit).not.toBeNull();
  });

  it('validates financial inputs and prevents another tenant from reading a transaction', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/finance/budgets')
      .set(bearerAuthHeaders(accessToken))
      .send({
        name: 'Invalid period',
        amount: 100,
        periodStart: '2026-09-01',
        periodEnd: '2026-08-01',
      })
      .expect(400);

    const transactionResponse = await request(app.getHttpServer())
      .post('/api/v1/finance/transactions')
      .set(bearerAuthHeaders(accessToken))
      .send({
        type: 'EXPENSE',
        category: 'Software',
        amount: 10,
        currency: 'USD',
        occurredAt: '2026-08-02T12:00:00.000Z',
      })
      .expect(201);
    const transaction = (transactionResponse.body as ApiSuccessResponse<{ id: string }>).data;

    const anotherTenant = await authenticateContext(app, prisma, usersRepository, 'admin', {
      email: 'finance-isolation@example.com',
    });
    await request(app.getHttpServer())
      .get(`/api/v1/finance/transactions/${transaction.id}`)
      .set(bearerAuthHeaders(anotherTenant.accessToken))
      .expect(404);
  });
});
