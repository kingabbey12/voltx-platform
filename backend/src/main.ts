import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap/configure-app';
import './error-reporting';
import './tracing';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true, bodyParser: false });

  // Activates NestJS's SIGTERM/SIGINT listeners so every provider's
  // OnModuleDestroy (e.g. PrismaService closing its connection pool) runs
  // before the process exits — without this call those hooks are dead code.
  app.enableShutdownHooks();

  configureApp(app);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port', 3000);

  await app.listen(port);
}

void bootstrap();
