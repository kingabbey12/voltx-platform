import { Injectable } from '@nestjs/common';
import { AuthContextRepository } from './auth-context.repository';
import { CurrentUser } from './interfaces/current-user.interface';

@Injectable()
export class AuthContextService {
  constructor(private readonly authContextRepository: AuthContextRepository) {}

  async resolveCurrentUser(userId: string, organizationId?: string): Promise<CurrentUser | null> {
    const membership = await this.authContextRepository.findActiveMembershipContext(
      userId,
      organizationId,
    );

    if (!membership) {
      return null;
    }

    return {
      id: membership.userId,
      organizationId: membership.organizationId,
      membershipId: membership.id,
      roles: [membership.roleName],
      permissions: this.resolvePermissions(membership.roleName),
    };
  }

  private resolvePermissions(roleName: string): string[] {
    const rolePermissions: Record<string, string[]> = {
      admin: ['users:read', 'users:write', 'organizations:read', 'organizations:write'],
      member: ['users:read', 'organizations:read'],
    };

    return rolePermissions[roleName] ?? [];
  }
}
