import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
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
import { HealthModule } from './modules/health/health.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { RolesModule } from './modules/roles/roles.module';
import { UsersModule } from './modules/users/users.module';

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
    DatabaseModule,
    TenantModule,
    AuditModule,
    AuthModule,
    HealthModule,
    OrganizationModule,
    PermissionsModule,
    RolesModule,
    UsersModule,
  ],
  providers: [LoggingInterceptor, ResponseInterceptor, TimeoutInterceptor],
})
export class AppModule {}
