import { RequestMethod } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { context, trace } from '@opentelemetry/api';
import { randomUUID } from 'node:crypto';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Params } from 'nestjs-pino';
import { REQUEST_ID_HEADER } from '../common/constants/request-id.constants';

/**
 * Injects the active OTel span's trace/span id into every log line, so a
 * log and a trace for the same request can be correlated in whatever
 * backend ingests both — without this, the two observability surfaces
 * (OTLP traces via src/tracing.ts, structured logs via pino) are
 * unlinked. Returns `{}` (not `{traceId: undefined, ...}`) when there is
 * no active span (OTEL_ENABLED=false, or a code path outside any span)
 * so the fields are simply absent from the JSON line rather than
 * present-but-null.
 */
export function traceContextMixin(): Record<string, string> {
  const span = trace.getSpan(context.active());
  if (!span) {
    return {};
  }
  const spanContext = span.spanContext();
  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
  };
}

export function createPinoConfig(configService: ConfigService): Params {
  const nodeEnv = configService.get<string>('nodeEnv', 'development');
  const logLevel = configService.get<string>('logLevel', 'info');
  const isProduction = nodeEnv === 'production';

  return {
    forRoutes: [{ path: '*path', method: RequestMethod.ALL }],
    pinoHttp: {
      level: logLevel,
      transport: isProduction
        ? undefined
        : {
            target: 'pino-pretty',
            options: {
              singleLine: true,
              colorize: true,
            },
          },
      autoLogging: true,
      mixin: traceContextMixin,
      customProps: (req: IncomingMessage) => ({
        requestId: req.headers[REQUEST_ID_HEADER],
      }),
      genReqId: (req: IncomingMessage, res: ServerResponse) => {
        const existing = req.headers[REQUEST_ID_HEADER];
        if (typeof existing === 'string' && existing.length > 0) {
          return existing;
        }
        const generated = randomUUID();
        req.headers[REQUEST_ID_HEADER] = generated;
        res.setHeader(REQUEST_ID_HEADER, generated);
        return generated;
      },
      redact: {
        paths: ['req.headers.authorization', 'req.headers.cookie'],
        remove: true,
      },
    },
  };
}
