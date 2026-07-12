import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiSuccessResponseDto } from '../../common/dto/api-response.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentUser as CurrentUserInterface } from '../auth/interfaces/current-user.interface';
import { ApiKeyGuard } from './guards/api-key.guard';

class ApiKeyWhoamiResponseDto {
  organizationId!: string;
  permissions!: string[];
}

class ApiKeyWhoamiSuccessResponseDto extends ApiSuccessResponseDto<ApiKeyWhoamiResponseDto> {}

/**
 * Demonstrates and exercises ApiKeyGuard as a genuine drop-in alternative to
 * AUTH_GUARDS: this route requires no JWT/Membership at all, only a valid
 * `X-Api-Key` header — ApiKeyGuard alone resolves org + permission context.
 * Lets a machine-to-machine caller introspect exactly which permissions its
 * own key currently carries, without needing to already know them.
 */
@ApiTags('Security — API Keys')
@ApiSecurity('ApiKey')
@Controller('security/api-keys/whoami')
@UseGuards(ApiKeyGuard)
export class ApiKeyAuthController {
  @Get()
  @ApiOperation({ summary: "Resolve the calling API key's organization and scoped permissions" })
  @ApiOkResponse({ description: 'Resolved API key context', type: ApiKeyWhoamiSuccessResponseDto })
  whoami(@CurrentUser() user: CurrentUserInterface): ApiKeyWhoamiResponseDto {
    return {
      organizationId: user.organizationId,
      permissions: user.permissions,
    };
  }
}
