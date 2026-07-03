import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthenticatedRequest } from '../../modules/auth/interfaces/authenticated-request.interface';
import { TenantContextService } from './tenant-context.service';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private readonly tenantContextService: TenantContextService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.currentUser) {
      throw new UnauthorizedException('Authenticated user context is missing');
    }

    if (!request.tenantJwtPrincipal) {
      throw new ForbiddenException('Tenant could not be resolved from JWT');
    }

    if (request.tenantJwtPrincipal.userId !== request.currentUser.id) {
      throw new ForbiddenException('Tenant user mismatch');
    }

    if (request.tenantJwtPrincipal.organizationId !== request.currentUser.organizationId) {
      throw new ForbiddenException('Cross-tenant access is forbidden');
    }

    const requestId = this.tenantContextService.get()?.requestId;
    if (!requestId) {
      throw new ForbiddenException('Request context is missing');
    }

    request.tenantContext = {
      organizationId: request.currentUser.organizationId,
      userId: request.currentUser.id,
      membershipId: request.currentUser.membershipId,
      requestId,
    };

    this.tenantContextService.set(request.tenantContext);

    return true;
  }
}
