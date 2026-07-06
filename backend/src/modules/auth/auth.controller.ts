import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ApiSuccessResponseDto } from '../../common/dto/api-response.dto';
import { CurrentUser } from './decorators/current-user.decorator';
import {
  AuthMeResponseDto,
  AuthTokensDto,
  LoginResponseDto,
  MessageResponseDto,
  MyOrganizationResponseDto,
  VerifyEmailResponseDto,
} from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SwitchOrganizationDto } from './dto/switch-organization.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { AUTH_GUARDS } from '../../common/guards/protected.guards';
import { CurrentUser as CurrentUserInterface } from './interfaces/current-user.interface';
import { AuthService } from './auth.service';

class LoginSuccessResponseDto extends ApiSuccessResponseDto<LoginResponseDto> {}

class AuthTokensSuccessResponseDto extends ApiSuccessResponseDto<AuthTokensDto> {}

class AuthMeSuccessResponseDto extends ApiSuccessResponseDto<AuthMeResponseDto> {}

class LogoutSuccessResponseDto extends ApiSuccessResponseDto<{ message: string }> {}

class MessageSuccessResponseDto extends ApiSuccessResponseDto<MessageResponseDto> {}

class VerifyEmailSuccessResponseDto extends ApiSuccessResponseDto<VerifyEmailResponseDto> {}

// Credential-guessing/enumeration endpoints need a tighter limit than the
// blanket API default (120/60s would allow 120 login attempts per minute
// per IP) — read directly from process.env since decorators are evaluated
// at module load, before Nest's DI container exists.
const AUTH_THROTTLE = {
  default: {
    limit: parseInt(process.env.AUTH_RATE_LIMIT_LIMIT ?? '10', 10),
    ttl: parseInt(process.env.AUTH_RATE_LIMIT_TTL_SECONDS ?? '60', 10) * 1000,
  },
};

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle(AUTH_THROTTLE)
  @ApiOperation({ summary: 'Authenticate with email and password' })
  @ApiOkResponse({ description: 'Access and refresh tokens issued', type: LoginSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials or inactive account' })
  login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(dto);
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle(AUTH_THROTTLE)
  @ApiOperation({ summary: 'Register a new user and organization workspace' })
  @ApiOkResponse({
    description: 'Account created and tokens issued',
    type: LoginSuccessResponseDto,
  })
  register(@Body() dto: RegisterDto): Promise<LoginResponseDto> {
    return this.authService.register(dto);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token and issue new access token' })
  @ApiOkResponse({ description: 'New token pair issued', type: AuthTokensSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired refresh token' })
  refresh(@Body() dto: RefreshTokenDto): Promise<AuthTokensDto> {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(...AUTH_GUARDS)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Revoke refresh token and end session' })
  @ApiOkResponse({ description: 'Session revoked', type: LogoutSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  async logout(
    @CurrentUser() user: CurrentUserInterface,
    @Body() dto: LogoutDto,
  ): Promise<{ message: string }> {
    await this.authService.logout(user.id, dto.refreshToken);
    return { message: 'Logged out successfully' };
  }

  @Get('me')
  @UseGuards(...AUTH_GUARDS)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get authenticated user profile and authorization context' })
  @ApiOkResponse({ description: 'Authenticated user context', type: AuthMeSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  getMe(@CurrentUser() user: CurrentUserInterface): Promise<AuthMeResponseDto> {
    return this.authService.getMe(user);
  }

  @Get('my-organizations')
  @UseGuards(...AUTH_GUARDS)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'List every organization the authenticated user actively belongs to' })
  @ApiOkResponse({
    description: 'Active memberships for the authenticated user',
    type: [MyOrganizationResponseDto],
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  async myOrganizations(
    @CurrentUser() user: CurrentUserInterface,
  ): Promise<MyOrganizationResponseDto[]> {
    const memberships = await this.authService.myOrganizations(user.id);
    return memberships.map((membership) => ({
      organizationId: membership.organizationId,
      organizationName: membership.organizationName,
      organizationSlug: membership.organizationSlug,
      roleKey: membership.roleKey,
      roleName: membership.roleName,
      joinedAt: membership.joinedAt.toISOString(),
    }));
  }

  @Post('switch-organization')
  @HttpCode(HttpStatus.OK)
  @UseGuards(...AUTH_GUARDS)
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Switch the active organization without signing out',
    description:
      'Issues a new token pair scoped to a different organization the user is an active member of.',
  })
  @ApiOkResponse({
    description: 'Tokens reissued for the new organization',
    type: LoginSuccessResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid access token' })
  switchOrganization(
    @CurrentUser() user: CurrentUserInterface,
    @Body() dto: SwitchOrganizationDto,
  ): Promise<LoginResponseDto> {
    return this.authService.switchOrganization(user, dto.organizationId);
  }

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @Throttle(AUTH_THROTTLE)
  @ApiOperation({ summary: 'Verify email address with a one-time token' })
  @ApiOkResponse({ description: 'Email verified', type: VerifyEmailSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired verification token' })
  verifyEmail(@Body() dto: VerifyEmailDto): Promise<VerifyEmailResponseDto> {
    return this.authService.verifyEmail(dto.token);
  }

  @Post('request-password-reset')
  @HttpCode(HttpStatus.OK)
  @Throttle(AUTH_THROTTLE)
  @ApiOperation({ summary: 'Request a password reset token' })
  @ApiOkResponse({
    description: 'Password reset request accepted',
    type: MessageSuccessResponseDto,
  })
  requestPasswordReset(@Body() dto: RequestPasswordResetDto): Promise<MessageResponseDto> {
    return this.authService.requestPasswordReset(dto);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @Throttle(AUTH_THROTTLE)
  @ApiOperation({ summary: 'Reset password with a one-time token' })
  @ApiOkResponse({ description: 'Password reset successfully', type: MessageSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired reset token' })
  resetPassword(@Body() dto: ResetPasswordDto): Promise<MessageResponseDto> {
    return this.authService.resetPassword(dto);
  }
}
