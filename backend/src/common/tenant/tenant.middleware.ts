import { Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { NextFunction, Response } from 'express';
import { REQUEST_ID_HEADER } from '../constants/request-id.constants';
import { JwtAccessPayload } from '../../modules/auth/interfaces/jwt-payload.interface';
import { AuthenticatedRequest } from '../../modules/auth/interfaces/authenticated-request.interface';
import { TenantContextService } from './tenant-context.service';

function extractBearerToken(authorizationHeader: string | undefined): string | undefined {
  if (!authorizationHeader?.startsWith('Bearer ')) {
    return undefined;
  }

  const token = authorizationHeader.slice('Bearer '.length).trim();
  return token.length > 0 ? token : undefined;
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(
    private readonly jwtService: JwtService,
    private readonly tenantContextService: TenantContextService,
    private readonly configService: ConfigService,
  ) {}

  use(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
    const requestIdHeader = req.headers[REQUEST_ID_HEADER];
    const requestId =
      typeof requestIdHeader === 'string' && requestIdHeader.length > 0
        ? requestIdHeader
        : crypto.randomUUID();

    const initialContext: {
      requestId: string;
      userId?: string;
      organizationId?: string;
    } = { requestId };

    const bearerToken = extractBearerToken(req.headers.authorization);
    if (bearerToken) {
      try {
        const payload = this.jwtService.verify<JwtAccessPayload>(bearerToken, {
          secret: this.configService.getOrThrow<string>('jwt.accessSecret'),
        });

        if (payload.type === 'access' && payload.sub && payload.org) {
          initialContext.userId = payload.sub;
          initialContext.organizationId = payload.org;
          req.tenantJwtPrincipal = {
            userId: payload.sub,
            organizationId: payload.org,
          };
        }
      } catch {
        // Invalid tokens are handled by JwtAuthGuard.
      }
    }

    this.tenantContextService.run(initialContext, () => next());
  }
}
