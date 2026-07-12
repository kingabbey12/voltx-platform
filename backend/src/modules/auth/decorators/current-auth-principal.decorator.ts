import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';
import { AuthPrincipal } from '../interfaces/auth-principal.interface';

/**
 * Like CurrentUser, but for PLATFORM_ADMIN_GUARDS routes: those compose
 * only JwtAuthGuard + PlatformAdminGuard (see protected.guards.ts),
 * never UserContextGuard, so request.currentUser is never populated —
 * only request.authPrincipal (resolved from the bearer token alone).
 */
export const CurrentAuthPrincipal = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthPrincipal => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.authPrincipal) {
      throw new UnauthorizedException('Authenticated principal is missing');
    }

    return request.authPrincipal;
  },
);
