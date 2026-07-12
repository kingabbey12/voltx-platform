import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { ApiSuccessResponseDto } from '../../common/dto/api-response.dto';
import { AUTH_GUARDS } from '../../common/guards/protected.guards';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentUser as CurrentUserInterface } from '../auth/interfaces/current-user.interface';
import { Permissions } from '../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../permissions/guards/permission.guard';
import { TrustDeviceDto, TrustedDeviceResponseDto } from './dto/trusted-device.dto';
import { TrustedDevicesService } from './trusted-devices.service';

class TrustedDeviceSuccessResponseDto extends ApiSuccessResponseDto<TrustedDeviceResponseDto> {}
class TrustedDeviceListSuccessResponseDto extends ApiSuccessResponseDto<
  TrustedDeviceResponseDto[]
> {}

@ApiTags('Security — Trusted Devices')
@ApiBearerAuth('JWT')
@Controller('security/trusted-devices')
@UseGuards(...AUTH_GUARDS, PermissionGuard)
@Permissions('security.trusted_device.manage')
export class TrustedDevicesController {
  constructor(private readonly trustedDevicesService: TrustedDevicesService) {}

  @Get()
  @ApiOperation({ summary: "List the authenticated user's trusted devices" })
  @ApiOkResponse({ description: 'Trusted devices', type: TrustedDeviceListSuccessResponseDto })
  list(@CurrentUser() user: CurrentUserInterface): Promise<TrustedDeviceResponseDto[]> {
    return this.trustedDevicesService.list(user.id, user.organizationId);
  }

  @Post()
  @ApiOperation({
    summary: 'Trust the current device — skips a future MFA challenge until it expires',
  })
  @ApiCreatedResponse({ description: 'Device trusted', type: TrustedDeviceSuccessResponseDto })
  trust(
    @CurrentUser() user: CurrentUserInterface,
    @Body() dto: TrustDeviceDto,
  ): Promise<TrustedDeviceResponseDto> {
    return this.trustedDevicesService.trust(user.id, user.organizationId, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Revoke trust for a device — its next login will be MFA-challenged again',
  })
  @ApiOkResponse({ description: 'Trust revoked' })
  async revoke(
    @CurrentUser() user: CurrentUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    await this.trustedDevicesService.revoke(id, user.id, user.organizationId);
    return { message: 'Trust revoked' };
  }
}
