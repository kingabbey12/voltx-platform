import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';
import { REQUEST_ID_HEADER } from '../constants/request-id.constants';

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers[REQUEST_ID_HEADER];
  const requestId = typeof incoming === 'string' && incoming.length > 0 ? incoming : randomUUID();

  req.headers[REQUEST_ID_HEADER] = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);
  next();
}
