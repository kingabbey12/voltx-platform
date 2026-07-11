import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { UsersRepository } from '../../modules/users/users.repository';
import { AuthenticatedRequest } from '../../modules/auth/interfaces/authenticated-request.interface';

/**
 * Gates the cross-organization Super Admin Billing Console. Deliberately
 * NOT composed with UserContextGuard/TenantGuard (see AUTH_GUARDS) —
 * those hard-require the caller's JWT org claim to match a single
 * target organization, which is actively wrong for "see every
 * organization." JwtAuthGuard alone already resolves
 * request.authPrincipal.userId from a valid bearer token regardless of
 * org; this guard just checks that user's platform-wide flag.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly usersRepository: UsersRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.authPrincipal?.userId;
    if (!userId) {
      throw new ForbiddenException('Platform admin access required');
    }

    const user = await this.usersRepository.findByIdUnscoped(userId);
    if (!user?.isPlatformAdmin) {
      throw new ForbiddenException('Platform admin access required');
    }

    return true;
  }
}
