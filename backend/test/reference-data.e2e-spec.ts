import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiSuccessResponse } from '../src/common/interceptors/response.interceptor';
import { PrismaService } from '../src/database/prisma.service';
import { CountryOption, StateOption } from '../src/modules/reference-data/reference-data.service';
import { UsersRepository } from '../src/modules/users/users.repository';
import { createTestApp } from './create-test-app';
import {
  authenticateContext,
  bearerAuthHeaders,
  resetAndSeedAuthTestData,
} from './helpers/users-test.helper';

describe('ReferenceDataController (e2e)', () => {
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

  it('rejects unauthenticated requests', async () => {
    await request(app.getHttpServer()).get('/api/v1/reference/countries').expect(401);
  });

  it('lists countries for an authenticated user', async () => {
    const owner = await authenticateContext(app, prisma, usersRepository, 'owner');

    const response = await request(app.getHttpServer())
      .get('/api/v1/reference/countries')
      .set(bearerAuthHeaders(owner.accessToken))
      .expect(200);

    const countries = (response.body as ApiSuccessResponse<CountryOption[]>).data;
    expect(countries.length).toBeGreaterThan(190);
    expect(countries.some((c) => c.isoCode === 'US')).toBe(true);
  });

  it('lists states for a country, and 404s for an unknown one', async () => {
    const owner = await authenticateContext(app, prisma, usersRepository, 'owner');

    const response = await request(app.getHttpServer())
      .get('/api/v1/reference/countries/US/states')
      .set(bearerAuthHeaders(owner.accessToken))
      .expect(200);
    const states = (response.body as ApiSuccessResponse<StateOption[]>).data;
    expect(states.some((s) => s.name === 'California')).toBe(true);

    await request(app.getHttpServer())
      .get('/api/v1/reference/countries/ZZ/states')
      .set(bearerAuthHeaders(owner.accessToken))
      .expect(404);
  });

  it('lists cities for a state given the country as a query param', async () => {
    const owner = await authenticateContext(app, prisma, usersRepository, 'owner');

    const response = await request(app.getHttpServer())
      .get('/api/v1/reference/states/CA/cities')
      .query({ country: 'US' })
      .set(bearerAuthHeaders(owner.accessToken))
      .expect(200);

    const cities = (response.body as ApiSuccessResponse<{ name: string }[]>).data;
    expect(cities.length).toBeGreaterThan(0);
  });

  it('lists currencies, timezones, industries, and languages', async () => {
    const owner = await authenticateContext(app, prisma, usersRepository, 'owner');
    const headers = bearerAuthHeaders(owner.accessToken);

    const currencies = await request(app.getHttpServer())
      .get('/api/v1/reference/currencies')
      .set(headers)
      .expect(200);
    expect(
      (currencies.body as ApiSuccessResponse<{ code: string }[]>).data.some(
        (c) => c.code === 'USD',
      ),
    ).toBe(true);

    const timezones = await request(app.getHttpServer())
      .get('/api/v1/reference/timezones')
      .set(headers)
      .expect(200);
    expect((timezones.body as ApiSuccessResponse<string[]>).data).toContain('America/New_York');

    const industries = await request(app.getHttpServer())
      .get('/api/v1/reference/industries')
      .set(headers)
      .expect(200);
    expect(
      (industries.body as ApiSuccessResponse<{ category: string }[]>).data.length,
    ).toBeGreaterThan(0);

    const languages = await request(app.getHttpServer())
      .get('/api/v1/reference/languages')
      .set(headers)
      .expect(200);
    expect(
      (languages.body as ApiSuccessResponse<{ code: string; name: string }[]>).data,
    ).toContainEqual({ code: 'en', name: 'English' });
  });
});
