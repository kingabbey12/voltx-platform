import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { MembershipStatus, Prisma, User } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { AuditService } from '../../audit/audit.service';
import { AuthService } from '../../auth/auth.service';
import { LoginResponseDto } from '../../auth/dto/auth-response.dto';
import { RoleRepository } from '../../roles/role.repository';
import { UserResponseDto } from '../../users/dto/user-response.dto';
import { UsersRepository } from '../../users/users.repository';
import { IdentityProviderEntity } from '../entities/identity-provider.entity';

export interface SsoProfile {
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  groups: string[];
}

/**
 * Just-in-time provisioning shared by both the SAML and OIDC callback paths
 * (see ../sso.service.ts) — mirrors InvitationService.accept()'s
 * existing-user-vs-new-user branching and terminates into the same
 * AuthService.issueTokens() every other login path uses.
 *
 * Every membership lookup/creation below is scoped to `idp.organizationId`,
 * which is read from the IdentityProvider row itself (looked up by its own
 * id, never by client-supplied organizationId) — this is what makes it
 * structurally impossible for organization A's identity provider to ever
 * provision a membership into organization B.
 */
@Injectable()
export class JitProvisioningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usersRepository: UsersRepository,
    private readonly roleRepository: RoleRepository,
    private readonly authService: AuthService,
    private readonly auditService: AuditService,
  ) {}

  async provisionAndIssueTokens(
    idp: IdentityProviderEntity,
    profile: SsoProfile,
  ): Promise<LoginResponseDto> {
    if (!profile.email) {
      throw new UnauthorizedException('SSO profile did not include an email address');
    }
    const email = profile.email.toLowerCase();

    const roleKey = this.resolveRoleKey(idp, profile.groups);
    const role = await this.roleRepository.findByKeyOrThrow(roleKey);

    const existingUser = await this.usersRepository.findByEmail(email);

    let userId: string;
    if (existingUser) {
      userId = existingUser.id;
      await this.upsertMembershipForExistingUser(idp, existingUser.id, role.id);
    } else {
      if (!idp.jitProvisioningEnabled) {
        throw new ForbiddenException(
          'No account exists for this email and just-in-time provisioning is disabled for this identity provider',
        );
      }
      userId = await this.createUserAndMembership(idp, email, profile, role.id);
    }

    await this.auditService.recordWithExplicitActor({
      action: 'sso_login',
      resource: 'identity_provider',
      resourceId: idp.id,
      organizationId: idp.organizationId,
      userId,
      metadata: { protocol: idp.protocol, preset: idp.preset },
    });

    const tokens = await this.authService.issueTokens(userId, idp.organizationId);
    const profileEntity = await this.usersRepository.findById(userId);
    if (!profileEntity) {
      throw new UnauthorizedException('Provisioned user not found');
    }

    return {
      ...tokens,
      user: UserResponseDto.fromEntity(profileEntity),
    };
  }

  private resolveRoleKey(idp: IdentityProviderEntity, groups: string[]): string {
    for (const rule of idp.roleMappingRules) {
      if (groups.includes(rule.sourceValue)) {
        return rule.roleKey;
      }
    }
    return idp.defaultRoleKey;
  }

  private async upsertMembershipForExistingUser(
    idp: IdentityProviderEntity,
    userId: string,
    roleId: string,
  ): Promise<void> {
    const membership = await this.prisma.system.membership.findFirst({
      where: { organizationId: idp.organizationId, userId },
    });

    if (membership) {
      if (membership.status === MembershipStatus.ACTIVE) {
        return;
      }
      if (!idp.jitProvisioningEnabled) {
        throw new ForbiddenException(
          'Your membership in this organization is inactive and just-in-time provisioning is disabled',
        );
      }
      await this.prisma.system.membership.update({
        where: { id: membership.id },
        data: {
          status: MembershipStatus.ACTIVE,
          roleId,
          provisionedByIdentityProviderId: idp.id,
        },
      });
      return;
    }

    if (!idp.jitProvisioningEnabled) {
      throw new ForbiddenException(
        'You are not a member of this organization and just-in-time provisioning is disabled for this identity provider',
      );
    }

    await this.prisma.system.membership.create({
      data: {
        organizationId: idp.organizationId,
        userId,
        roleId,
        status: MembershipStatus.ACTIVE,
        provisionedByIdentityProviderId: idp.id,
      },
    });
  }

  private async createUserAndMembership(
    idp: IdentityProviderEntity,
    email: string,
    profile: SsoProfile,
    roleId: string,
  ): Promise<string> {
    const firstName = profile.firstName?.trim() || email.split('@')[0];
    const lastName = profile.lastName?.trim() || '—';

    try {
      const result = await this.prisma.system.$transaction(async (tx) => {
        const createdUser: User = await tx.user.create({
          data: {
            email,
            firstName,
            lastName,
            status: 'ACTIVE',
            emailVerifiedAt: new Date(),
          },
        });

        await tx.membership.create({
          data: {
            organizationId: idp.organizationId,
            userId: createdUser.id,
            roleId,
            status: MembershipStatus.ACTIVE,
            provisionedByIdentityProviderId: idp.id,
          },
        });

        return createdUser;
      });
      return result.id;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const raced = await this.usersRepository.findByEmail(email);
        if (raced) {
          await this.upsertMembershipForExistingUser(idp, raced.id, roleId);
          return raced.id;
        }
      }
      throw error;
    }
  }
}
