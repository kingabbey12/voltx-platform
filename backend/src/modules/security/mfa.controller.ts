import { Body, Controller, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { ApiSuccessResponseDto } from '../../common/dto/api-response.dto';
import { AUTH_GUARDS } from '../../common/guards/protected.guards';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { LoginResponseDto } from '../auth/dto/auth-response.dto';
import { CurrentUser as CurrentUserInterface } from '../auth/interfaces/current-user.interface';
import {
  MfaBackupCodesResponseDto,
  MfaDisableDto,
  MfaRegenerateBackupCodesDto,
  MfaSetupResponseDto,
  MfaVerifyLoginDto,
  MfaVerifySetupDto,
} from './dto/mfa.dto';
import { MfaService } from './mfa.service';

class MfaSetupSuccessResponseDto extends ApiSuccessResponseDto<MfaSetupResponseDto> {}
class MfaBackupCodesSuccessResponseDto extends ApiSuccessResponseDto<MfaBackupCodesResponseDto> {}
class LoginSuccessResponseDto extends ApiSuccessResponseDto<LoginResponseDto> {}

// MFA code verification is a credential-guessing surface exactly like
// login — same tight, explicit rate limit rather than the blanket default.
const MFA_THROTTLE = {
  default: {
    limit: parseInt(process.env.AUTH_RATE_LIMIT_LIMIT ?? '10', 10),
    ttl: parseInt(process.env.AUTH_RATE_LIMIT_TTL_SECONDS ?? '60', 10) * 1000,
  },
};

@ApiTags('Security — MFA')
@Controller('security/mfa')
export class MfaController {
  constructor(private readonly mfaService: MfaService) {}

  @Post('setup')
  @HttpCode(HttpStatus.OK)
  @UseGuards(...AUTH_GUARDS)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Start TOTP MFA enrollment for the authenticated user' })
  @ApiOkResponse({
    description: 'Pending secret + otpauth URI for a QR code',
    type: MfaSetupSuccessResponseDto,
  })
  setup(@CurrentUser() user: CurrentUserInterface): Promise<MfaSetupResponseDto> {
    return this.mfaService.setup(user.id);
  }

  @Post('setup/verify')
  @HttpCode(HttpStatus.OK)
  @UseGuards(...AUTH_GUARDS)
  @Throttle(MFA_THROTTLE)
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Confirm TOTP enrollment',
    description: 'Enables MFA and returns one-time backup codes — shown exactly once.',
  })
  @ApiOkResponse({
    description: 'MFA enabled; backup codes issued',
    type: MfaBackupCodesSuccessResponseDto,
  })
  async verifySetup(
    @CurrentUser() user: CurrentUserInterface,
    @Body() dto: MfaVerifySetupDto,
  ): Promise<MfaBackupCodesResponseDto> {
    const backupCodes = await this.mfaService.verifySetup(user.id, dto.code);
    return { backupCodes };
  }

  @Post('disable')
  @HttpCode(HttpStatus.OK)
  @UseGuards(...AUTH_GUARDS)
  @Throttle(MFA_THROTTLE)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Disable MFA — requires a current TOTP or backup code' })
  @ApiOkResponse({ description: 'MFA disabled' })
  async disable(
    @CurrentUser() user: CurrentUserInterface,
    @Body() dto: MfaDisableDto,
  ): Promise<{ message: string }> {
    await this.mfaService.disable(user.id, dto.code);
    return { message: 'Multi-factor authentication disabled' };
  }

  @Post('backup-codes/regenerate')
  @HttpCode(HttpStatus.OK)
  @UseGuards(...AUTH_GUARDS)
  @Throttle(MFA_THROTTLE)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Invalidate existing backup codes and issue a new set' })
  @ApiOkResponse({ description: 'New backup codes issued', type: MfaBackupCodesSuccessResponseDto })
  async regenerateBackupCodes(
    @CurrentUser() user: CurrentUserInterface,
    @Body() dto: MfaRegenerateBackupCodesDto,
  ): Promise<MfaBackupCodesResponseDto> {
    const backupCodes = await this.mfaService.regenerateBackupCodes(user.id, dto.code);
    return { backupCodes };
  }

  @Post('verify-login')
  @HttpCode(HttpStatus.OK)
  @Throttle(MFA_THROTTLE)
  @ApiOperation({
    summary: 'Complete a login that was challenged for MFA',
    description:
      'Public endpoint — the caller has no access token yet, only the mfaChallengeToken from POST /auth/login.',
  })
  @ApiOkResponse({ description: 'Access and refresh tokens issued', type: LoginSuccessResponseDto })
  verifyLogin(@Body() dto: MfaVerifyLoginDto, @Req() request: Request): Promise<LoginResponseDto> {
    return this.mfaService.verifyLogin(dto, {
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });
  }
}
