import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import {
  DEV_ORGANIZATION_ID_HEADER,
  DEV_USER_ID_HEADER,
  isValidUuid,
} from '../constants/development-auth.constants';
import { AuthenticatedRequest } from '../interfaces/authenticated-request.interface';
import { AuthContextRepository } from '../auth-context.repository';

@Injectable()
export class DevelopmentAuthGuard implements CanActivate {
  constructor(private readonly authContextRepository: AuthContextRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userIdHeader = request.headers[DEV_USER_ID_HEADER];
    const organizationIdHeader = request.headers[DEV_ORGANIZATION_ID_HEADER];

    const userId = typeof userIdHeader === 'string' ? userIdHeader.trim() : undefined;
    const organizationId =
      typeof organizationIdHeader === 'string' ? organizationIdHeader.trim() : undefined;

    if (!userId || !isValidUuid(userId)) {
      throw new UnauthorizedException(`Missing or invalid ${DEV_USER_ID_HEADER} header`);
    }

    if (organizationId && !isValidUuid(organizationId)) {
      throw new UnauthorizedException(`Invalid ${DEV_ORGANIZATION_ID_HEADER} header`);
    }

    const userExists = await this.authContextRepository.userExists(userId);
    if (!userExists) {
      throw new UnauthorizedException('Authenticated user not found');
    }

    request.authPrincipal = {
      userId,
      organizationId,
    };

    return true;
  }
}
