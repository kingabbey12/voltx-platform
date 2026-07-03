import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { ApiSuccessResponse } from '../src/common/interceptors/response.interceptor';
import { HealthCheckResult } from '../src/modules/health/health.service';
import { createTestApp } from './create-test-app';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    app = await createTestApp();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/api/v1/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect((res) => {
        const body = res.body as ApiSuccessResponse<HealthCheckResult>;
        expect(body.success).toBe(true);
        expect(body.data.status).toBe('ok');
        expect(body.data.timestamp).toBeDefined();
        expect(body.data.uptime).toBeGreaterThanOrEqual(0);
        expect(body.meta.version).toBe('v1');
        expect(body.meta.timestamp).toBeDefined();
      });
  });

  it('sets x-request-id header on responses', () => {
    return request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect((res) => {
        expect(res.headers['x-request-id']).toBeDefined();
        const body = res.body as ApiSuccessResponse<HealthCheckResult>;
        expect(body.meta.requestId).toBe(res.headers['x-request-id']);
      });
  });

  it('propagates incoming x-request-id header', () => {
    const requestId = 'test-request-id-123';

    return request(app.getHttpServer())
      .get('/api/v1/health')
      .set('x-request-id', requestId)
      .expect(200)
      .expect((res) => {
        expect(res.headers['x-request-id']).toBe(requestId);
        const body = res.body as ApiSuccessResponse<HealthCheckResult>;
        expect(body.meta.requestId).toBe(requestId);
      });
  });

  it('/api serves OpenAPI documentation', () => {
    return request(app.getHttpServer()).get('/api').expect(200).expect('content-type', /html/);
  });

  it('/api-json returns OpenAPI 3.1 spec', () => {
    return request(app.getHttpServer())
      .get('/api-json')
      .expect(200)
      .expect((res) => {
        const spec = res.body as { openapi: string; info: { title: string; version: string } };
        expect(spec.openapi).toBe('3.1.0');
        expect(spec.info.title).toBe('Voltx Platform API');
        expect(spec.info.version).toBe('v1');
      });
  });
});
