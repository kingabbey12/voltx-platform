import { createParamDecorator, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AuthenticatedRequest } from '../../../modules/auth/interfaces/authenticated-request.interface';
import { TenantContext } from '../interfaces/tenant-context.interface';

export const TenantContextParam = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): TenantContext => {
    const request = ctx.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.tenantContext) {
      throw new ForbiddenException('Valid tenant context is required');
    }

    return request.tenantContext;
  },
);

export function getTenantContextFromRequest(
  request: AuthenticatedRequest,
): TenantContext | undefined {
  return request.tenantContext;
}
