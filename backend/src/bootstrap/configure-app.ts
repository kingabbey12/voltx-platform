import { INestApplication, RequestMethod, ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import compression from 'compression';
import helmet from 'helmet';
import { Express, json, urlencoded } from 'express';
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
  const corsAllowedOrigins = configService.get<string[]>('security.corsAllowedOrigins', []);
  const trustedProxyCount = configService.get<number>('security.trustedProxyCount', 0);

  // Governs how Express resolves `request.ip` (used by IpAllowlistGuard,
  // Security Center login-history, and rate limiting). 0 means "trust
  // nothing" — the raw socket address is used and X-Forwarded-For is
  // ignored, so a client can never spoof its IP by sending that header
  // unless an operator explicitly configures the real number of trusted
  // reverse-proxy hops in front of this API via TRUSTED_PROXY_COUNT.
  const httpAdapterInstance = app.getHttpAdapter().getInstance() as Express;
  httpAdapterInstance.set('trust proxy', trustedProxyCount);

  app.use(requestIdMiddleware);
  app.useLogger(app.get(Logger));
  app.use(
    helmet({
      // The API serves only JSON to native/mobile clients plus the Swagger
      // UI at /api/docs — CSP would need per-route relaxation for Swagger's
      // inline scripts/styles and buys little for a non-HTML-rendering API,
      // so it stays off. Every other helmet default (HSTS, X-Frame-Options,
      // X-Content-Type-Options, etc.) still applies.
      contentSecurityPolicy: false,
      crossOriginResourcePolicy: false,
    }),
  );
  app.enableCors({
    // Closed by default: an empty allowlist means no browser origin is
    // trusted with credentials until CORS_ALLOWED_ORIGINS is set. Native
    // mobile clients (Dio) never send an Origin header and are unaffected.
    origin: corsAllowedOrigins.length > 0 ? corsAllowedOrigins : false,
    credentials: true,
  });
  app.use(compression());
  app.use(
    json({
      limit: requestBodyLimit,
      inflate: true,
      // Webhook signature verification (Slack/GitHub/Stripe/generic) needs the
      // exact raw bytes — a re-serialized JSON body would break HMAC checks.
      verify: (request, _response, buffer) => {
        (request as unknown as { rawBody?: Buffer }).rawBody = buffer;
      },
    }),
  );
  app.use(
    urlencoded({
      extended: true,
      limit: requestBodyLimit,
      inflate: true,
      // Twilio's webhook signature scheme signs the exact raw form body
      // (see TwilioSignature.verify) — same reasoning as the json()
      // verify callback above, just for Twilio's form-encoded webhooks
      // instead of JSON ones.
      verify: (request, _response, buffer) => {
        (request as unknown as { rawBody?: Buffer }).rawBody = buffer;
      },
    }),
  );
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
