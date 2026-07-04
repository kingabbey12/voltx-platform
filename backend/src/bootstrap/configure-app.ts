import { INestApplication, RequestMethod, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import compression from 'compression';
import helmet from 'helmet';
import { json, urlencoded } from 'express';
import { Logger } from 'nestjs-pino';
import { GlobalExceptionFilter } from '../common/filters/global-exception.filter';
import { LoggingInterceptor } from '../common/interceptors/logging.interceptor';
import { ResponseInterceptor } from '../common/interceptors/response.interceptor';
import { TimeoutInterceptor } from '../common/interceptors/timeout.interceptor';
import { requestIdMiddleware } from '../common/middleware/request-id.middleware';
import { createSwaggerDocument, setupSwagger } from '../config/swagger.config';

export function configureApp(app: INestApplication): void {
  const configService = app.get(ConfigService);
  const requestBodyLimit = configService.get<string>('security.requestBodyLimit', '1mb');

  app.use(requestIdMiddleware);
  app.useLogger(app.get(Logger));
  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: false,
    }),
  );
  app.use(compression());
  app.use(json({ limit: requestBodyLimit, inflate: true }));
  app.use(urlencoded({ extended: true, limit: requestBodyLimit, inflate: true }));
  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'metrics', method: RequestMethod.GET },
      { path: 'readiness', method: RequestMethod.GET },
      { path: 'liveness', method: RequestMethod.GET },
    ],
  });
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(
    app.get(LoggingInterceptor),
    app.get(ResponseInterceptor),
    app.get(TimeoutInterceptor),
  );
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const swaggerDocument = createSwaggerDocument(app);
  setupSwagger(app, swaggerDocument);
}
