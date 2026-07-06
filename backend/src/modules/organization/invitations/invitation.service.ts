import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MembershipStatus, Prisma, User } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { AuditService } from '../../audit/audit.service';
import { AuthService } from '../../auth/auth.service';
import { INVITATION_EXPIRES_IN_DAYS } from '../../auth/constants/auth.constants';
import { LoginResponseDto, MessageResponseDto } from '../../auth/dto/auth-response.dto';
import { UserResponseDto } from '../../users/dto/user-response.dto';
import {
  generateVerificationToken,
  hashVerificationToken,
} from '../../auth/utils/verification-token.util';
import { hashPassword } from '../../auth/utils/password.util';
import { AcceptInvitationDto, CreateInvitationDto } from './dto/invitation.dto';
import { InvitationEntity, InvitationPreviewEntity } from './invitation.entity';
import {
  InvitationRepository,
  ListInvitationsParams,
  PaginatedInvitations,
} from './invitation.repository';

const NON_INVITABLE_ROLE_KEYS = new Set(['owner']);

@Injectable()
export class InvitationService {
  constructor(
    private readonly invitationRepository: InvitationRepository,
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly authService: AuthService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async create(
    organizationId: string,
    invitedByUserId: string,
    dto: CreateInvitationDto,
  ): Promise<{ entity: InvitationEntity; token: string }> {
    this.tenantContextService.assertOrganizationAccess(organizationId);
    const email = dto.email.trim().toLowerCase();

    const role = await this.prisma.system.role.findUnique({ where: { id: dto.roleId } });
    if (!role) {
      throw new BadRequestException('Requested role does not exist');
    }
    if (NON_INVITABLE_ROLE_KEYS.has(role.key)) {
      throw new BadRequestException('The owner role cannot be granted via invitation');
    }

    const existingMember = await this.prisma.system.membership.findFirst({
      where: { organizationId, status: MembershipStatus.ACTIVE, user: { email } },
    });
    if (existingMember) {
      throw new ConflictException('This email already belongs to a member of this organization');
    }

    const existingPending = await this.invitationRepository.findPendingByOrgAndEmail(
      organizationId,
      email,
    );
    if (existingPending) {
      throw new ConflictException(
        'A pending invitation already exists for this email — revoke or resend it instead',
      );
    }

    const token = generateVerificationToken();
    const entity = await this.invitationRepository.create({
      organizationId,
      email,
      roleId: dto.roleId,
      tokenHash: hashVerificationToken(token),
      invitedByUserId,
      expiresAt: getInvitationExpiresAt(),
    });

    await this.auditService.record({
      action: 'invite',
      resource: 'organization_invitation',
      resourceId: entity.id,
      metadata: { organizationId, email, roleId: dto.roleId },
    });

    return { entity, token };
  }

  async list(params: ListInvitationsParams): Promise<PaginatedInvitations> {
    this.tenantContextService.assertOrganizationAccess(params.organizationId);
    return this.invitationRepository.list(params);
  }

  async revoke(organizationId: string, invitationId: string): Promise<InvitationEntity> {
    this.tenantContextService.assertOrganizationAccess(organizationId);
    const invitation = await this.getPendingOrThrow(organizationId, invitationId);
    await this.invitationRepository.markRevoked(invitation.id);

    await this.auditService.record({
      action: 'revoke',
      resource: 'organization_invitation',
      resourceId: invitation.id,
      metadata: { organizationId, email: invitation.email },
    });

    return { ...invitation, status: 'REVOKED' as const, revokedAt: new Date() };
  }

  async resend(
    organizationId: string,
    invitationId: string,
  ): Promise<{ entity: InvitationEntity; token: string }> {
    this.tenantContextService.assertOrganizationAccess(organizationId);
    const invitation = await this.getPendingOrThrow(organizationId, invitationId);

    const token = generateVerificationToken();
    const expiresAt = getInvitationExpiresAt();
    await this.invitationRepository.refreshTokenAndExpiry(
      invitation.id,
      hashVerificationToken(token),
      expiresAt,
    );

    await this.auditService.record({
      action: 'resend',
      resource: 'organization_invitation',
      resourceId: invitation.id,
      metadata: { organizationId, email: invitation.email },
    });

    return { entity: { ...invitation, expiresAt }, token };
  }

  async preview(token: string): Promise<InvitationPreviewEntity> {
    const invitation = await this.findValidByTokenOrThrow(token);

    const existingUser = await this.prisma.system.user.findFirst({
      where: { email: invitation.email, deletedAt: null },
      select: { id: true },
    });

    return {
      organizationName: invitation.organizationName,
      invitedByName: invitation.invitedByName,
      email: invitation.email,
      roleName: invitation.roleName,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      hasExistingAccount: existingUser !== null,
    };
  }

  async accept(
    token: string,
    dto: AcceptInvitationDto,
  ): Promise<
    | { newAccount: true; session: LoginResponseDto }
    | { newAccount: false; message: MessageResponseDto }
  > {
    const invitation = await this.findValidByTokenOrThrow(token);

    const existingUser = await this.prisma.system.user.findFirst({
      where: { email: invitation.email, deletedAt: null },
    });

    if (existingUser) {
      const alreadyMember = await this.prisma.system.membership.findFirst({
        where: { organizationId: invitation.organizationId, userId: existingUser.id },
      });
      if (alreadyMember) {
        if (alreadyMember.status === MembershipStatus.ACTIVE) {
          throw new ConflictException('You are already a member of this organization');
        }
        await this.prisma.system.membership.update({
          where: { id: alreadyMember.id },
          data: { status: MembershipStatus.ACTIVE, roleId: invitation.roleId },
        });
      } else {
        await this.prisma.system.membership.create({
          data: {
            organizationId: invitation.organizationId,
            userId: existingUser.id,
            roleId: invitation.roleId,
            status: MembershipStatus.ACTIVE,
          },
        });
      }

      await this.invitationRepository.markAccepted(invitation.id, existingUser.id);
      await this.recordAcceptedAudit(invitation, existingUser.id);

      return {
        newAccount: false,
        message: {
          message:
            'Invitation accepted. Sign in to your existing account to see the new organization.',
        },
      };
    }

    if (!dto.password || !dto.firstName || !dto.lastName) {
      throw new BadRequestException(
        'password, firstName, and lastName are required to create a new account',
      );
    }

    const passwordHash = await hashPassword(dto.password);
    // Two near-simultaneous accepts of the same invitation can both pass
    // the "does a user exist yet" check above before either commits — the
    // loser hits a raw unique-constraint violation on User.email, which
    // without this catch bubbled up as an unhelpful 500 instead of a
    // clean, expected "someone already accepted this" response.
    let user: User;
    try {
      const result = await this.prisma.system.$transaction(async (tx) => {
        const createdUser = await tx.user.create({
          data: {
            email: invitation.email,
            firstName: dto.firstName!.trim(),
            lastName: dto.lastName!.trim(),
            passwordHash,
            status: 'ACTIVE',
          },
        });

        await tx.membership.create({
          data: {
            organizationId: invitation.organizationId,
            userId: createdUser.id,
            roleId: invitation.roleId,
            status: MembershipStatus.ACTIVE,
          },
        });

        return { user: createdUser };
      });
      user = result.user;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException(
          'This invitation was just accepted in another request — try signing in instead.',
        );
      }
      throw error;
    }

    await this.invitationRepository.markAccepted(invitation.id, user.id);
    await this.recordAcceptedAudit(invitation, user.id);

    const tokens = await this.authService.issueTokens(user.id, invitation.organizationId);

    return {
      newAccount: true,
      session: {
        ...tokens,
        user: UserResponseDto.fromEntity(user),
      },
    };
  }

  private async recordAcceptedAudit(
    invitation: InvitationEntity & { organizationName?: string },
    acceptedByUserId: string,
  ): Promise<void> {
    // accept() runs unauthenticated (no JWT yet, possibly no session ever
    // established for an existing-account acceptance) — there is no
    // JWT-derived tenant context to pull from, so the actor is passed
    // explicitly instead of relying on TenantContextService.
    await this.auditService.recordWithExplicitActor({
      action: 'accept',
      resource: 'organization_invitation',
      resourceId: invitation.id,
      organizationId: invitation.organizationId,
      userId: acceptedByUserId,
      metadata: { organizationId: invitation.organizationId },
    });
  }

  private async getPendingOrThrow(
    organizationId: string,
    invitationId: string,
  ): Promise<InvitationEntity> {
    const invitation = await this.invitationRepository.findByIdInOrg(organizationId, invitationId);
    if (!invitation) {
      throw new NotFoundException('Invitation not found');
    }
    if (invitation.status !== 'PENDING') {
      throw new BadRequestException(`Invitation is already ${invitation.status.toLowerCase()}`);
    }
    return invitation;
  }

  private async findValidByTokenOrThrow(
    token: string,
  ): Promise<InvitationEntity & { organizationName: string }> {
    const tokenHash = hashVerificationToken(token);
    const invitation = await this.invitationRepository.findByTokenHash(tokenHash);
    if (!invitation) {
      throw new NotFoundException('Invitation not found or already used');
    }
    if (invitation.status !== 'PENDING') {
      throw new BadRequestException(
        `This invitation has already been ${invitation.status.toLowerCase()}`,
      );
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('This invitation has expired — ask for a new one to be sent');
    }
    return invitation;
  }
}

function getInvitationExpiresAt(now = new Date()): Date {
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + INVITATION_EXPIRES_IN_DAYS);
  return expiresAt;
}
