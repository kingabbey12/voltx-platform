import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';
import { CurrentUser as CurrentUserInterface } from '../interfaces/current-user.interface';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUserInterface => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.currentUser) {
      throw new UnauthorizedException('Authenticated user context is missing');
    }

    return request.currentUser;
  },
);
