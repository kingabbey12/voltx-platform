import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiSuccessResponseDto } from '../../common/dto/api-response.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentUser as CurrentUserInterface } from '../auth/interfaces/current-user.interface';
import { ServiceAccountGuard } from './guards/service-account.guard';

class ServiceAccountWhoamiResponseDto {
  organizationId!: string;
  permissions!: string[];
}

class ServiceAccountWhoamiSuccessResponseDto extends ApiSuccessResponseDto<ServiceAccountWhoamiResponseDto> {}

/**
 * Demonstrates and exercises ServiceAccountGuard as a genuine drop-in
 * alternative to AUTH_GUARDS, mirroring ApiKeyAuthController — this route
 * requires no JWT/human Membership at all, only a valid
 * X-Service-Account-Token header.
 */
@ApiTags('Developer Platform — Service Accounts')
@ApiSecurity('ServiceAccountToken')
@Controller('developer/service-accounts/whoami')
@UseGuards(ServiceAccountGuard)
export class ServiceAccountAuthController {
  @Get()
  @ApiOperation({
    summary: "Resolve the calling service account token's organization and current permissions",
  })
  @ApiOkResponse({
    description: 'Resolved service account context',
    type: ServiceAccountWhoamiSuccessResponseDto,
  })
  whoami(@CurrentUser() user: CurrentUserInterface): ServiceAccountWhoamiResponseDto {
    return {
      organizationId: user.organizationId,
      permissions: user.permissions,
    };
  }
}
