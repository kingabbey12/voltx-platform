import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
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

  // Wire Pino as the application logger BEFORE anything else logs. Without
  // this call here, Logger instances that run before configureApp (such as
  // the boot seed below) write to NestJS's default ConsoleLogger and their
  // messages are held in the bufferLogs buffer, appearing only after
  // app.listen() — making the seed look silent in Render's startup log.
  // configureApp() also calls app.useLogger(); that second call is a no-op.
  app.useLogger(app.get(Logger));

  // Make the seed-integrity safety net unambiguously happen before the app
  // accepts traffic, rather than only depending on the Nest lifecycle hook.
  await app.get(DatabaseSeedBootstrapService).ensureSeedIntegrityOnBootstrap();

  configureApp(app);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port', 3000);

  await app.listen(port);
}

void bootstrap();
