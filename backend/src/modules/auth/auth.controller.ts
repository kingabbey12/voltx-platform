import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiSuccessResponseDto } from '../../common/dto/api-response.dto';
import { CurrentUser } from './decorators/current-user.decorator';
import {
  AuthMeResponseDto,
  AuthTokensDto,
  LoginResponseDto,
  MessageResponseDto,
  VerifyEmailResponseDto,
} from './dto/auth-response.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
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

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Authenticate with email and password' })
  @ApiOkResponse({ description: 'Access and refresh tokens issued', type: LoginSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials or inactive account' })
  login(@Body() dto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(dto);
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user and organization workspace' })
  @ApiOkResponse({ description: 'Account created and tokens issued', type: LoginSuccessResponseDto })
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

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify email address with a one-time token' })
  @ApiOkResponse({ description: 'Email verified', type: VerifyEmailSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired verification token' })
  verifyEmail(@Body() dto: VerifyEmailDto): Promise<VerifyEmailResponseDto> {
    return this.authService.verifyEmail(dto.token);
  }

  @Post('request-password-reset')
  @HttpCode(HttpStatus.OK)
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
  @ApiOperation({ summary: 'Reset password with a one-time token' })
  @ApiOkResponse({ description: 'Password reset successfully', type: MessageSuccessResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired reset token' })
  resetPassword(@Body() dto: ResetPasswordDto): Promise<MessageResponseDto> {
    return this.authService.resetPassword(dto);
  }
}
