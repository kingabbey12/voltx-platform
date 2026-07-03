import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';
import configuration from './config/configuration';
import { validate } from './config/env.validation';
import { createPinoConfig } from './config/pino-logger.config';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './modules/health/health.module';
import { OrganizationModule } from './modules/organization/organization.module';

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
    HealthModule,
    OrganizationModule,
  ],
  providers: [LoggingInterceptor, ResponseInterceptor, TimeoutInterceptor],
})
export class AppModule {}
