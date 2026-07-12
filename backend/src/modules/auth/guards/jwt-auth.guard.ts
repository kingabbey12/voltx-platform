import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JWT_ACCESS_STRATEGY } from '../constants/auth.constants';
import { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

@Injectable()
export class JwtAuthGuard extends AuthGuard(JWT_ACCESS_STRATEGY) {
  handleRequest<
    TUser extends { userId: string; organizationId?: string; supportSessionId?: string },
  >(err: Error | null, user: TUser | false, _info: unknown, context: ExecutionContext): TUser {
    if (err || !user) {
      throw err ?? new UnauthorizedException('Invalid or missing access token');
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    request.authPrincipal = {
      userId: user.userId,
      organizationId: user.organizationId,
      supportSessionId: user.supportSessionId,
    };

    return user;
  }
}
