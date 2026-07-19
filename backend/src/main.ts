import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './bootstrap/configure-app';
import { assertRedisRequirement } from './bootstrap/redis-requirement.check';
import { DatabaseSeedBootstrapService } from './database/seed/database-seed-bootstrap.service';
import './error-reporting';
import './tracing';

async function bootstrap(): Promise<void> {
  // Runs before any module bootstraps (in particular before BullModule's
  // per-module forRoot() calls) so a production deploy without Redis, or
  // with Redis enabled but unreachable, fails fast at startup rather than
  // booting successfully and silently dropping background work later.
  await assertRedisRequirement();

  const app = await NestFactory.create(AppModule, { bufferLogs: true, bodyParser: false });

  // Activates NestJS's SIGTERM/SIGINT listeners so every provider's
  // OnModuleDestroy (e.g. PrismaService closing its connection pool) runs
  // before the process exits — without this call those hooks are dead code.
  app.enableShutdownHooks();

  // Make the seed-integrity safety net unambiguously happen before the app
  // accepts traffic, rather than only depending on the Nest lifecycle hook.
  await app.get(DatabaseSeedBootstrapService).ensureSeedIntegrityOnBootstrap();

  configureApp(app);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port', 3000);

  await app.listen(port);
}

void bootstrap();
