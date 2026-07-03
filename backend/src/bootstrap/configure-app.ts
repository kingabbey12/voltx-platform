import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Logger } from 'nestjs-pino';
import { GlobalExceptionFilter } from '../common/filters/global-exception.filter';
import { LoggingInterceptor } from '../common/interceptors/logging.interceptor';
import { ResponseInterceptor } from '../common/interceptors/response.interceptor';
import { TimeoutInterceptor } from '../common/interceptors/timeout.interceptor';
import { requestIdMiddleware } from '../common/middleware/request-id.middleware';
import { createSwaggerDocument, setupSwagger } from '../config/swagger.config';

export function configureApp(app: INestApplication): void {
  app.use(requestIdMiddleware);
  app.useLogger(app.get(Logger));
  app.setGlobalPrefix('api');
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
