import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { LoggerModule } from 'nestjs-pino';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';
import configuration from './config/configuration';
import { validate } from './config/env.validation';
import { createPinoConfig } from './config/pino-logger.config';
import { AuthModule } from './modules/auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { TenantModule } from './common/tenant/tenant.module';
import { AuditModule } from './modules/audit/audit.module';
import { BillingModule } from './modules/billing/billing.module';
import { AgentModule } from './modules/ai/agents/agent.module';
import { AIModule } from './modules/ai/ai.module';
import { AttachmentsModule } from './modules/attachments/attachments.module';
import { BackgroundJobsModule } from './modules/background-jobs/background-jobs.module';
import { CommunicationsModule } from './modules/communications/communications.module';
import { HealthModule } from './modules/health/health.module';
import { IntegrationModule } from './modules/integrations/integration.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { NotificationModule } from './modules/notifications/notification.module';
import { OperatorModule } from './modules/ai/operator/operator.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { ReferenceDataModule } from './modules/reference-data/reference-data.module';
import { RolesModule } from './modules/roles/roles.module';
import { SalesModule } from './modules/sales/sales.module';
import { UsersModule } from './modules/users/users.module';
import { WorkflowModule } from './modules/workflows/workflow.module';
import { WorkflowEventsModule } from './modules/workflows/scheduling/workflow-events.module';
import { EncryptionModule } from './modules/integrations/security/encryption.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
      envFilePath:
        process.env.NODE_ENV === 'test'
          ? ['.env.test', '.env.local', '.env']
          : ['.env.local', '.env'],
    }),
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => createPinoConfig(configService),
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            ttl: configService.get<number>('security.rateLimitTtlSeconds', 60) * 1000,
            limit: configService.get<number>('security.rateLimitLimit', 120),
          },
        ],
      }),
    }),
    ScheduleModule.forRoot(),
    DatabaseModule,
    MetricsModule,
    TenantModule,
    AuditModule,
    WorkflowEventsModule,
    EncryptionModule,
    AIModule,
    AgentModule,
    AttachmentsModule,
    BackgroundJobsModule,
    BillingModule,
    AuthModule,
    CommunicationsModule,
    HealthModule,
    IntegrationModule,
    KnowledgeModule,
    NotificationModule,
    OperatorModule,
    OrganizationModule,
    PermissionsModule,
    ReferenceDataModule,
    RolesModule,
    SalesModule,
    UsersModule,
    WorkflowModule,
  ],
  providers: [
    LoggingInterceptor,
    ResponseInterceptor,
    TimeoutInterceptor,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
