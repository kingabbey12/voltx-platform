import { RequestMethod } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Params } from 'nestjs-pino';
import { REQUEST_ID_HEADER } from '../common/constants/request-id.constants';

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
