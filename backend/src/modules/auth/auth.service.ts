import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserStatus } from '@prisma/client';
import { UsersRepository } from '../users/users.repository';
import { UserResponseDto } from '../users/dto/user-response.dto';
import { AuthContextRepository } from './auth-context.repository';
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
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
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

    const profile = await this.usersRepository.findById(user.id);
    if (!profile) {
      throw new UnauthorizedException('Authenticated user not found');
    }

    return {
      ...tokens,
      user: UserResponseDto.fromEntity(profile),
    };
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

    return {
      ...userDto,
      organizationId: currentUser.organizationId,
      membershipId: currentUser.membershipId,
      roles: currentUser.roles,
      permissions: currentUser.permissions,
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

  private async issueTokens(userId: string, organizationId: string): Promise<AuthTokensDto> {
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
