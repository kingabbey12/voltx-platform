import { Injectable } from '@nestjs/common';
import { PermissionService } from '../permissions/permission.service';
import { AuthContextRepository } from './auth-context.repository';
import { CurrentUser } from './interfaces/current-user.interface';

@Injectable()
export class AuthContextService {
  constructor(
    private readonly authContextRepository: AuthContextRepository,
    private readonly permissionService: PermissionService,
  ) {}

  async resolveCurrentUser(userId: string, organizationId?: string): Promise<CurrentUser | null> {
    const membership = await this.authContextRepository.findActiveMembershipContext(
      userId,
      organizationId,
    );

    if (!membership) {
      return null;
    }

    const permissions = await this.permissionService.getPermissionKeysForRole(membership.roleId);

    return {
      id: membership.userId,
      organizationId: membership.organizationId,
      membershipId: membership.id,
      roles: [membership.roleKey],
      permissions,
    };
  }
}
