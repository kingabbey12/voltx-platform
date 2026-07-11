import {
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { MembershipStatus, OrganizationStatus, UserStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { OrganizationRepository } from '../organization/organization.repository';
import { generateUniqueOrganizationSlug } from '../organization/utils/organization-slug.util';
import { UsersRepository } from '../users/users.repository';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { UserEntity } from '../users/entities/user.entity';
import { BillingAccountService } from '../billing/billing-account.service';
import { PlanService } from '../billing/plan.service';
import { SubscriptionService } from '../billing/subscription.service';
import { AuthContextRepository, MembershipSummary } from './auth-context.repository';
import { AuthRepository } from './auth.repository';
import { ACCESS_TOKEN_EXPIRES_IN } from './constants/auth.constants';
import {
  AuthMeResponseDto,
  AuthTokensDto,
  LoginResponseDto,
  MessageResponseDto,
  VerifyEmailResponseDto,
} from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { CurrentUser } from './interfaces/current-user.interface';
import { JwtAccessPayload } from './interfaces/jwt-payload.interface';
import { RefreshTokenRepository } from './refresh-token.repository';
import { VerificationTokenService } from './verification-token.service';
import { hashPassword, verifyPassword } from './utils/password.util';
import {
  generateRefreshToken,
  getRefreshTokenExpiresAt,
  hashRefreshToken,
} from './utils/refresh-token.util';

@Injectable()
export class AuthService {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly refreshTokenRepository: RefreshTokenRepository,
    private readonly verificationTokenService: VerificationTokenService,
    private readonly authContextRepository: AuthContextRepository,
    private readonly usersRepository: UsersRepository,
    private readonly organizationRepository: OrganizationRepository,
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly billingAccountService: BillingAccountService,
    private readonly subscriptionService: SubscriptionService,
    private readonly planService: PlanService,
  ) {}

  async login(dto: LoginDto): Promise<LoginResponseDto> {
    const user = await this.authRepository.findUserByEmail(dto.email);

    if (!user?.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordValid = await verifyPassword(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('User account is not active');
    }

    const membership = await this.authContextRepository.findActiveMembershipContext(
      user.id,
      dto.organizationId,
    );

    if (!membership) {
      throw new UnauthorizedException('Active organization membership not found');
    }

    const tokens = await this.issueTokens(user.id, membership.organizationId);
    await this.authRepository.updateLastLoginAt(user.id);

    let profile = await this.usersRepository.findById(user.id);
    if (!profile) {
      throw new UnauthorizedException('Authenticated user not found');
    }

    profile = (await this.selfHealPlatformAdmin(profile)) ?? profile;

    return {
      ...tokens,
      user: UserResponseDto.fromEntity(profile),
    };
  }

  async register(dto: RegisterDto): Promise<LoginResponseDto> {
    const existing = await this.authRepository.findUserByEmail(dto.email);
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const organizationName =
      dto.organizationName?.trim() || `${dto.firstName.trim()} ${dto.lastName.trim()}`.trim();
    const slug = await generateUniqueOrganizationSlug(organizationName, (candidate) =>
      this.organizationRepository.isSlugTaken(candidate),
    );
    const passwordHash = await hashPassword(dto.password);
    const ownerRole = await this.prisma.system.role.findUniqueOrThrow({
      where: { key: 'owner' },
    });

    const { organization, user } = await this.prisma.system.$transaction(async (tx) => {
      const createdOrganization = await tx.organization.create({
        data: {
          name: organizationName,
          slug,
          status: OrganizationStatus.ACTIVE,
        },
      });

      const createdUser = await tx.user.create({
        data: {
          email: dto.email.toLowerCase(),
          firstName: dto.firstName.trim(),
          lastName: dto.lastName.trim(),
          passwordHash,
          status: UserStatus.ACTIVE,
        },
      });

      await tx.membership.create({
        data: {
          userId: createdUser.id,
          organizationId: createdOrganization.id,
          roleId: ownerRole.id,
          status: MembershipStatus.ACTIVE,
        },
      });

      return { organization: createdOrganization, user: createdUser };
    });

    await this.verificationTokenService.issueEmailVerificationToken(user.id);
    await this.startTrialSubscription(organization.id, user.id, user.email);
    const tokens = await this.issueTokens(user.id, organization.id);
    const profile = await this.usersRepository.findById(user.id);

    if (!profile) {
      throw new UnauthorizedException('Registered user not found');
    }

    return {
      ...tokens,
      user: UserResponseDto.fromEntity(profile),
    };
  }

  /**
   * Every new organization starts on a real, locally-tracked trial of
   * the Professional plan — no Stripe Subscription object exists yet
   * (Phase 2's StripeSubscriptionService creates one the moment a
   * payment method is attached or the trial converts). Not in the same
   * $transaction as org/user/membership creation, matching this
   * method's existing precedent of issuing the email verification token
   * as a best-effort follow-up step after that core transaction commits.
   */
  private async startTrialSubscription(
    organizationId: string,
    userId: string,
    email: string,
  ): Promise<void> {
    const billingAccount = await this.billingAccountService.createForOrganization({
      organizationId,
      email,
    });
    const plan = await this.planService.getPlanByKeyOrThrow('professional');
    await this.subscriptionService.createTrialSubscription(
      organizationId,
      billingAccount.id,
      plan,
      userId,
    );
  }

  /**
   * Grants (and self-heals, if already granted) cross-organization Super
   * Admin Billing Console access from the PLATFORM_ADMIN_EMAILS env
   * allowlist — checked on every login rather than only at account
   * creation, so adding/removing an email from the allowlist takes
   * effect on that user's next login without any manual DB step.
   */
  private async selfHealPlatformAdmin(profile: UserEntity): Promise<UserEntity | null> {
    const allowlist = this.configService.get<string[]>('billing.platformAdminEmails', []);
    const shouldBeAdmin = allowlist.includes(profile.email.toLowerCase());
    if (shouldBeAdmin === profile.isPlatformAdmin) {
      return null;
    }
    return this.usersRepository.setPlatformAdmin(profile.id, shouldBeAdmin);
  }

  async refresh(refreshToken: string): Promise<AuthTokensDto> {
    const tokenHash = hashRefreshToken(refreshToken);
    const storedToken = await this.refreshTokenRepository.findValidByTokenHash(tokenHash);

    if (!storedToken) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    await this.refreshTokenRepository.revokeById(storedToken.id);

    const membership = await this.authContextRepository.findActiveMembershipContext(
      storedToken.userId,
    );

    if (!membership) {
      throw new UnauthorizedException('Active organization membership not found');
    }

    return this.issueTokens(storedToken.userId, membership.organizationId);
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    const tokenHash = hashRefreshToken(refreshToken);
    const storedToken = await this.refreshTokenRepository.findValidByTokenHash(tokenHash);

    if (!storedToken || storedToken.userId !== userId) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.refreshTokenRepository.revokeById(storedToken.id);
  }

  async getMe(currentUser: CurrentUser): Promise<AuthMeResponseDto> {
    const profile = await this.usersRepository.findById(currentUser.id);
    if (!profile) {
      throw new UnauthorizedException('Authenticated user not found');
    }

    const userDto = UserResponseDto.fromEntity(profile);
    const organization = await this.organizationRepository.findById();

    return {
      ...userDto,
      organizationId: currentUser.organizationId,
      membershipId: currentUser.membershipId,
      roles: currentUser.roles,
      permissions: currentUser.permissions,
      onboardingCompleted: organization?.onboardingCompletedAt != null,
    };
  }

  async myOrganizations(userId: string): Promise<MembershipSummary[]> {
    return this.authContextRepository.listActiveMembershipsForUser(userId);
  }

  async switchOrganization(
    currentUser: CurrentUser,
    organizationId: string,
  ): Promise<LoginResponseDto> {
    const membership = await this.authContextRepository.findActiveMembershipContext(
      currentUser.id,
      organizationId,
    );

    if (!membership) {
      throw new ForbiddenException('You are not an active member of that organization');
    }

    const tokens = await this.issueTokens(currentUser.id, membership.organizationId);
    const profile = await this.usersRepository.findById(currentUser.id);
    if (!profile) {
      throw new UnauthorizedException('Authenticated user not found');
    }

    return {
      ...tokens,
      user: UserResponseDto.fromEntity(profile),
    };
  }

  async verifyEmail(token: string): Promise<VerifyEmailResponseDto> {
    const { userId } = await this.verificationTokenService.consumeEmailVerificationToken(token);
    const emailVerifiedAt = await this.authRepository.markEmailVerified(userId);

    return {
      message: 'Email verified successfully',
      emailVerifiedAt: emailVerifiedAt.toISOString(),
    };
  }

  async requestPasswordReset(dto: RequestPasswordResetDto): Promise<MessageResponseDto> {
    const userId = await this.authRepository.findUserIdByEmail(dto.email);

    if (userId) {
      await this.verificationTokenService.issuePasswordResetToken(userId);
    }

    return {
      message: 'If the account exists, a password reset email has been sent.',
    };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<MessageResponseDto> {
    const { userId } = await this.verificationTokenService.consumePasswordResetToken(dto.token);
    const passwordHash = await hashPassword(dto.password);

    await this.authRepository.setPasswordHash(userId, passwordHash);
    await this.refreshTokenRepository.revokeAllByUserId(userId);

    return {
      message: 'Password reset successfully',
    };
  }

  /** Public so InvitationService can log a user in immediately after they
   * accept an invitation by creating a brand-new account (the invitation
   * token itself is the proof of email ownership in that case, exactly
   * like register() creating a session on account creation). */
  async issueTokens(userId: string, organizationId: string): Promise<AuthTokensDto> {
    const payload: JwtAccessPayload = {
      sub: userId,
      org: organizationId,
      type: 'access',
    };

    const accessToken = await this.jwtService.signAsync(payload);
    const refreshToken = generateRefreshToken();
    const refreshTokenHash = hashRefreshToken(refreshToken);

    await this.refreshTokenRepository.create(userId, refreshTokenHash, getRefreshTokenExpiresAt());

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.getAccessTokenExpiresInSeconds(),
    };
  }

  private getAccessTokenExpiresInSeconds(): number {
    const configured = this.configService.get<string>(
      'jwt.accessExpiresIn',
      ACCESS_TOKEN_EXPIRES_IN,
    );
    const match = /^(\d+)([smhd])$/.exec(configured);

    if (!match) {
      return 900;
    }

    const value = Number.parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 60 * 60;
      case 'd':
        return value * 60 * 60 * 24;
      default:
        return 900;
    }
  }
}
