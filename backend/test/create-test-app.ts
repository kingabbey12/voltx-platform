import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap/configure-app';

export async function createTestApp(): Promise<INestApplication<App>> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication({ bufferLogs: true, bodyParser: false });

  try {
    configureApp(app);
    await app.init();
  } catch (e) {
    console.error('[BOOTSTRAP_ERROR] Exception during app.init():');
    console.error(e);
    throw e;
  }

  return app;
}
