import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthContextService } from '../auth-context.service';
import { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';

@Injectable()
export class UserContextGuard implements CanActivate {
  constructor(private readonly authContextService: AuthContextService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.authPrincipal) {
      throw new UnauthorizedException('Authentication principal is missing');
    }

    const currentUser = await this.authContextService.resolveCurrentUser(
      request.authPrincipal.userId,
      request.authPrincipal.organizationId,
    );

    if (!currentUser) {
      throw new UnauthorizedException('Active organization membership not found');
    }

    request.currentUser = currentUser;

    return true;
  }
}
