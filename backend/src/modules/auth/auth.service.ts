import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { MembershipStatus, OrganizationStatus, UserStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { SystemSeedService } from '../../database/seed/system-seed.service';
import { OrganizationRepository } from '../organization/organization.repository';
import { generateUniqueOrganizationSlug } from '../organization/utils/organization-slug.util';
import { parseOrganizationSecurityPolicy } from '../organization/utils/organization-security-policy.util';
import { UsersRepository } from '../users/users.repository';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { UserEntity } from '../users/entities/user.entity';
import { AuditService } from '../audit/audit.service';
import { MailService } from '../mail/mail.service';
import { passwordResetTemplate, verifyEmailTemplate } from '../mail/mail.templates';
import { BillingAccountService } from '../billing/billing-account.service';
import { PlanService } from '../billing/plan.service';
import { SubscriptionService } from '../billing/subscription.service';
import { AuthContextRepository, MembershipSummary } from './auth-context.repository';
import { AuthRepository, AuthUserRecord } from './auth.repository';
import { ACCESS_TOKEN_EXPIRES_IN } from './constants/auth.constants';
import {
  AuthMeResponseDto,
  AuthTokensDto,
  LoginResponseDto,
  MessageResponseDto,
  MfaChallengeResponseDto,
  VerifyEmailResponseDto,
} from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { CurrentUser } from './interfaces/current-user.interface';
import { JwtAccessPayload, MfaChallengePayload } from './interfaces/jwt-payload.interface';
import { LoginRequestMeta } from './interfaces/login-request-meta.interface';
import { RefreshTokenRepository } from './refresh-token.repository';
import { SessionRepository } from './session.repository';
import { TrustedDeviceRepository } from './trusted-device.repository';
import { VerificationTokenService } from './verification-token.service';
import { parseDurationToSeconds } from './utils/duration.util';
import { hashPassword, verifyPassword } from './utils/password.util';
import {
  generateRefreshToken,
  getRefreshTokenExpiresAt,
  hashRefreshToken,
} from './utils/refresh-token.util';

type MfaRequirement = 'none' | 'challenge' | 'enrollment_required';

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
    private readonly sessionRepository: SessionRepository,
    private readonly trustedDeviceRepository: TrustedDeviceRepository,
    private readonly auditService: AuditService,
    private readonly mailService: MailService,
    private readonly systemSeedService: SystemSeedService,
  ) {}

  private readonly logger = new Logger(AuthService.name);

  async login(
    dto: LoginDto,
    requestMeta?: LoginRequestMeta,
  ): Promise<LoginResponseDto | MfaChallengeResponseDto> {
    const user = await this.authRepository.findUserByEmail(dto.email);

    if (!user?.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const passwordValid = await verifyPassword(dto.password, user.passwordHash);
    if (!passwordValid) {
      // Not audited here: dto.organizationId is client-supplied and not yet
      // verified against a real membership at this point in the flow, and
      // AuditLog rows are organization-scoped — writing one keyed off an
      // unverified organizationId would let anyone with a valid email
      // inject rows into an org's tamper-evident chain that they have no
      // membership in. Failed attempts are still bounded by AUTH_THROTTLE;
      // successful logins (below) are audited once membership is verified.
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

    // v2.2 Security Center MFA gate — must run strictly before any token is
    // issued below. `enrollment_required` hard-blocks the login rather than
    // silently letting it through, since a policy the affected user can
    // route around by simply never enrolling would be no policy at all.
    const mfaRequirement = await this.evaluateMfaRequirement(user, membership.organizationId);
    if (mfaRequirement === 'enrollment_required') {
      await this.auditService.recordWithExplicitActor({
        action: 'auth.login_blocked_mfa_required',
        resource: 'user',
        resourceId: user.id,
        organizationId: membership.organizationId,
        userId: user.id,
      });
      throw new ForbiddenException(
        'Multi-factor authentication setup is required by your organization before you can sign in',
      );
    }
    if (mfaRequirement === 'challenge') {
      const deviceIsTrusted = dto.deviceFingerprint
        ? await this.trustedDeviceRepository.isTrusted(
            user.id,
            membership.organizationId,
            dto.deviceFingerprint,
          )
        : false;
      if (!deviceIsTrusted) {
        return this.issueMfaChallenge(user.id, membership.organizationId);
      }
    }

    const session = await this.sessionRepository.create({
      userId: user.id,
      organizationId: membership.organizationId,
      deviceFingerprint: dto.deviceFingerprint,
      ipAddress: requestMeta?.ipAddress,
      userAgent: requestMeta?.userAgent,
    });

    await this.auditService.recordWithExplicitActor({
      action: 'auth.login_succeeded',
      resource: 'session',
      resourceId: session.id,
      organizationId: membership.organizationId,
      userId: user.id,
      metadata: { ipAddress: requestMeta?.ipAddress },
    });

    return this.buildLoginResponse(user.id, membership.organizationId, session.id);
  }

  /**
   * Shared tail of a successful login — issues tokens under the given
   * Session, records lastLoginAt, and loads the profile. Public so
   * POST /security/mfa/verify-login (security module) can call the exact
   * same completion logic after it independently verifies a TOTP/backup
   * code against a still-valid MFA challenge token, instead of duplicating
   * this sequence.
   */
  async buildLoginResponse(
    userId: string,
    organizationId: string,
    sessionId: string,
  ): Promise<LoginResponseDto> {
    const tokens = await this.issueTokens(userId, organizationId, sessionId);
    await this.authRepository.updateLastLoginAt(userId);

    let profile = await this.usersRepository.findById(userId);
    if (!profile) {
      throw new UnauthorizedException('Authenticated user not found');
    }

    profile = (await this.selfHealPlatformAdmin(profile)) ?? profile;

    return {
      ...tokens,
      user: UserResponseDto.fromEntity(profile),
    };
  }

  /** Whether this login attempt must be challenged for a second factor
   * before any JWT is issued. Consulted only by login() above — the
   * equivalent decision never re-runs for the MFA-verify-login call itself,
   * which instead trusts a previously-issued, still-valid challenge token. */
  private async evaluateMfaRequirement(
    user: Pick<AuthUserRecord, 'mfaEnabled'>,
    organizationId: string,
  ): Promise<MfaRequirement> {
    if (user.mfaEnabled) {
      return 'challenge';
    }

    const organization = await this.prisma.system.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    });
    const policy = parseOrganizationSecurityPolicy(organization?.settings);

    return policy.mfaRequired ? 'enrollment_required' : 'none';
  }

  /**
   * Issues a short-lived (default 5m) MFA challenge token instead of full
   * JWTs. `type: 'mfa_challenge'` makes it structurally impossible for
   * JwtAuthGuard/JwtAccessStrategy to accept this as a bearer access token
   * (see MfaChallengePayload). Only POST /security/mfa/verify-login (in the
   * new security module) ever decodes and redeems one, after verifying a
   * TOTP or backup code — that is the only other call site in the codebase
   * that reaches issueTokens() for a password-login attempt.
   */
  async issueMfaChallenge(
    userId: string,
    organizationId: string,
  ): Promise<MfaChallengeResponseDto> {
    const payload: MfaChallengePayload = {
      sub: userId,
      org: organizationId,
      type: 'mfa_challenge',
    };
    const expiresInConfig = this.configService.get<string>('mfa.challengeExpiresIn', '5m');
    const mfaChallengeToken = await this.jwtService.signAsync(payload, {
      expiresIn: expiresInConfig as JwtSignOptions['expiresIn'],
    });

    return {
      mfaRequired: true,
      mfaChallengeToken,
      expiresIn: parseDurationToSeconds(expiresInConfig, 300),
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
    const ownerRole = await this.resolveOwnerRole();

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

    const { token: verificationToken } =
      await this.verificationTokenService.issueEmailVerificationToken(user.id);
    await this.sendVerificationEmail(user.email, verificationToken);
    await this.startTrialSubscription(organization.id, user.id, user.email);
    await this.auditService.recordWithExplicitActor({
      action: 'auth.register_succeeded',
      resource: 'organization',
      resourceId: organization.id,
      organizationId: organization.id,
      userId: user.id,
    });
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
   * Resolves the system `owner` role assigned to a new organization's
   * creator. If it's missing — a database that was migrated but never
   * seeded, which historically surfaced as an opaque Prisma P2025 on every
   * signup — this self-heals by seeding the RBAC catalog on demand (the
   * database is provably warm at request time) and re-fetching, so the
   * first registration recovers instead of failing the whole platform.
   */
  private async resolveOwnerRole(): Promise<{ id: string }> {
    const existing = await this.prisma.system.role.findUnique({ where: { key: 'owner' } });
    if (existing) {
      return existing;
    }

    this.logger.warn('System "owner" role is missing at registration — seeding RBAC on demand');
    await this.systemSeedService.ensureRbac();

    const repaired = await this.prisma.system.role.findUnique({ where: { key: 'owner' } });
    if (!repaired) {
      throw new UnauthorizedException(
        'Registration is temporarily unavailable: system roles could not be provisioned. Please try again shortly.',
      );
    }
    return repaired;
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
    let plan = await this.planService.findPlanByKey('professional');
    if (!plan) {
      // Same self-heal as the owner role: a migrated-but-unseeded database
      // is missing the plan catalog too. Seed on demand and re-fetch so a
      // new org still gets its trial instead of erroring after commit.
      this.logger.warn(
        'Professional plan is missing at registration — seeding billing plans on demand',
      );
      await this.systemSeedService.ensureBillingPlans();
      plan = await this.planService.getPlanByKeyOrThrow('professional');
    }
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
      await this.handlePossibleRefreshTokenReuse(tokenHash);
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    await this.refreshTokenRepository.revokeById(storedToken.id);

    const membership = await this.authContextRepository.findActiveMembershipContext(
      storedToken.userId,
    );

    if (!membership) {
      throw new UnauthorizedException('Active organization membership not found');
    }

    // v2.2 Security Center — rotation carries the same Session forward
    // rather than creating a new one, so a session revoke still cascades to
    // every RefreshToken descended from it, however many times it's rotated.
    // `sessionId` is null for tokens issued before this column existed (or
    // via a path that never created a Session), in which case this is a
    // no-op exactly like before.
    if (storedToken.sessionId) {
      await this.sessionRepository.touchLastActiveAt(storedToken.sessionId);
    }

    return this.issueTokens(
      storedToken.userId,
      membership.organizationId,
      storedToken.sessionId ?? undefined,
    );
  }

  /**
   * A presented refresh-token hash that fails findValidByTokenHash() is
   * ambiguous on its own: it could be garbage, a naturally expired token,
   * or — the dangerous case — a legitimately-issued token that was already
   * rotated out by an earlier refresh, being replayed by whoever stole it
   * off the original device. Only the last case is a theft signal, so we
   * look the hash up again with no state filter to tell them apart: a
   * revoked-but-not-expired hit means reuse. The response to attackers and
   * to a client that simply retried a request is deliberately identical
   * (both just get "Invalid or expired refresh token" from the caller) —
   * this only changes what happens server-side.
   */
  private async handlePossibleRefreshTokenReuse(tokenHash: string): Promise<void> {
    const replayed = await this.refreshTokenRepository.findByTokenHash(tokenHash);
    if (!replayed || !replayed.revokedAt) {
      return;
    }

    if (replayed.sessionId) {
      await this.sessionRepository.revoke(replayed.sessionId);
    } else {
      await this.refreshTokenRepository.revokeAllByUserId(replayed.userId);
    }

    const membership = await this.authContextRepository
      .findActiveMembershipContext(replayed.userId)
      .catch(() => null);

    if (membership) {
      await this.auditService.recordWithExplicitActor({
        action: 'auth.refresh_token_reuse_detected',
        resource: 'session',
        resourceId: replayed.sessionId ?? replayed.id,
        organizationId: membership.organizationId,
        userId: replayed.userId,
        metadata: { refreshTokenId: replayed.id },
      });
    }
  }

  async logout(userId: string, refreshToken: string): Promise<void> {
    const tokenHash = hashRefreshToken(refreshToken);
    const storedToken = await this.refreshTokenRepository.findValidByTokenHash(tokenHash);

    if (!storedToken || storedToken.userId !== userId) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.refreshTokenRepository.revokeById(storedToken.id);

    const organizationId = storedToken.sessionId
      ? (await this.sessionRepository.findActiveById(storedToken.sessionId))?.organizationId
      : (await this.authContextRepository.findActiveMembershipContext(userId))?.organizationId;

    if (organizationId) {
      await this.auditService.recordWithExplicitActor({
        action: 'auth.logout',
        resource: 'session',
        resourceId: storedToken.sessionId ?? storedToken.id,
        organizationId,
        userId,
      });
    }
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

    await this.auditService.recordWithExplicitActor({
      action: 'auth.organization_switched',
      resource: 'organization',
      resourceId: membership.organizationId,
      organizationId: membership.organizationId,
      userId: currentUser.id,
      metadata: { fromOrganizationId: currentUser.organizationId },
    });

    return {
      ...tokens,
      user: UserResponseDto.fromEntity(profile),
    };
  }

  async verifyEmail(token: string): Promise<VerifyEmailResponseDto> {
    const { userId } = await this.verificationTokenService.consumeEmailVerificationToken(token);
    const emailVerifiedAt = await this.authRepository.markEmailVerified(userId);

    const membership = await this.authContextRepository.findActiveMembershipContext(userId);
    if (membership) {
      await this.auditService.recordWithExplicitActor({
        action: 'auth.email_verified',
        resource: 'user',
        resourceId: userId,
        organizationId: membership.organizationId,
        userId,
      });
    }

    return {
      message: 'Email verified successfully',
      emailVerifiedAt: emailVerifiedAt.toISOString(),
    };
  }

  async requestPasswordReset(dto: RequestPasswordResetDto): Promise<MessageResponseDto> {
    const userId = await this.authRepository.findUserIdByEmail(dto.email);

    if (userId) {
      const { token } = await this.verificationTokenService.issuePasswordResetToken(userId);
      await this.sendPasswordResetEmail(dto.email, token);

      const membership = await this.authContextRepository.findActiveMembershipContext(userId);
      if (membership) {
        await this.auditService.recordWithExplicitActor({
          action: 'auth.password_reset_requested',
          resource: 'user',
          resourceId: userId,
          organizationId: membership.organizationId,
          userId,
        });
      }
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

    const membership = await this.authContextRepository.findActiveMembershipContext(userId);
    if (membership) {
      await this.auditService.recordWithExplicitActor({
        action: 'auth.password_reset_completed',
        resource: 'user',
        resourceId: userId,
        organizationId: membership.organizationId,
        userId,
      });
    }

    return {
      message: 'Password reset successfully',
    };
  }

  /**
   * Public so InvitationService can log a user in immediately after they
   * accept an invitation by creating a brand-new account (the invitation
   * token itself is the proof of email ownership in that case, exactly
   * like register() creating a session on account creation), and so the
   * SSO module's JIT-provisioning login path and the v2.2 Security Center's
   * MFA-verify-login endpoint can terminate into the exact same
   * token-issuance logic rather than a parallel copy of it.
   *
   * `sessionId` is new in v2.2 and purely additive: every pre-existing call
   * site (register, switchOrganization, SSO JIT, invitation-accept) calls
   * this with two arguments and is completely unaffected — it simply
   * creates a RefreshToken with no Session attached, exactly as before.
   */
  async issueTokens(
    userId: string,
    organizationId: string,
    sessionId?: string,
  ): Promise<AuthTokensDto> {
    const payload: JwtAccessPayload = {
      sub: userId,
      org: organizationId,
      type: 'access',
    };

    const accessToken = await this.jwtService.signAsync(payload);
    const refreshToken = generateRefreshToken();
    const refreshTokenHash = hashRefreshToken(refreshToken);

    await this.refreshTokenRepository.create(
      userId,
      refreshTokenHash,
      getRefreshTokenExpiresAt(),
      sessionId,
    );

    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer',
      expiresIn: this.getAccessTokenExpiresInSeconds(),
    };
  }

  /**
   * v2.2 Customer Success — mints ONLY a short-lived access token for an
   * active SupportSession (impersonation): no refresh token, no Session
   * row, unlike issueTokens() above. A leaked long-lived refresh token
   * would be a much worse footgun for a support session than simply
   * requiring the platform admin to start a fresh, re-audited
   * SupportSession once it expires. Reuses the exact same JwtService/
   * JwtAccessPayload shape as issueTokens — just the `supportSessionId`
   * claim and a caller-supplied expiry differ.
   */
  async issueImpersonationAccessToken(
    userId: string,
    organizationId: string,
    supportSessionId: string,
    expiresInSeconds: number,
  ): Promise<{ accessToken: string; tokenType: 'Bearer'; expiresIn: number }> {
    const payload: JwtAccessPayload = {
      sub: userId,
      org: organizationId,
      type: 'access',
      supportSessionId,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: expiresInSeconds,
    });

    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: expiresInSeconds,
    };
  }

  private getAccessTokenExpiresInSeconds(): number {
    const configured = this.configService.get<string>(
      'jwt.accessExpiresIn',
      ACCESS_TOKEN_EXPIRES_IN,
    );
    return parseDurationToSeconds(configured, 900);
  }

  private async sendVerificationEmail(email: string, token: string): Promise<void> {
    const webAppBaseUrl = this.configService.get<string>('mail.webAppBaseUrl', '');
    const verifyUrl = `${webAppBaseUrl}/verify-email?token=${encodeURIComponent(token)}`;
    const { subject, html, text } = verifyEmailTemplate(verifyUrl);
    await this.mailService.send({ to: email, subject, html, text });
  }

  private async sendPasswordResetEmail(email: string, token: string): Promise<void> {
    const webAppBaseUrl = this.configService.get<string>('mail.webAppBaseUrl', '');
    const resetUrl = `${webAppBaseUrl}/reset-password?token=${encodeURIComponent(token)}`;
    const { subject, html, text } = passwordResetTemplate(resetUrl);
    await this.mailService.send({ to: email, subject, html, text });
  }
}
