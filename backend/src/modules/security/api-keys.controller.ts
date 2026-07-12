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
import { ApiKeysService } from './api-keys.service';
import { ApiKeyResponseDto, CreateApiKeyDto, CreateApiKeyResponseDto } from './dto/api-key.dto';
import { IpAllowlistGuard } from './guards/ip-allowlist.guard';

class ApiKeySuccessResponseDto extends ApiSuccessResponseDto<CreateApiKeyResponseDto> {}
class ApiKeyListSuccessResponseDto extends ApiSuccessResponseDto<ApiKeyResponseDto[]> {}

// IpAllowlistGuard runs after PermissionGuard (needs request.currentUser
// already resolved) — machine-credential management is exactly the kind of
// sensitive action an org may want restricted to known office/VPN egress IPs.
@ApiTags('Security — API Keys')
@ApiBearerAuth('JWT')
@Controller('security/api-keys')
@UseGuards(...AUTH_GUARDS, PermissionGuard, IpAllowlistGuard)
@Permissions('security.apikey.manage')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  @ApiOperation({
    summary: 'Create an organization API key',
    description: 'The full key is returned exactly once in this response and never again.',
  })
  @ApiCreatedResponse({ description: 'API key created', type: ApiKeySuccessResponseDto })
  create(
    @CurrentUser() user: CurrentUserInterface,
    @Body() dto: CreateApiKeyDto,
  ): Promise<CreateApiKeyResponseDto> {
    return this.apiKeysService.create(user.organizationId, user.id, user.permissions, dto);
  }

  @Get()
  @ApiOperation({ summary: "List the organization's API keys (redacted)" })
  @ApiOkResponse({ description: 'API keys', type: ApiKeyListSuccessResponseDto })
  list(@CurrentUser() user: CurrentUserInterface): Promise<ApiKeyResponseDto[]> {
    return this.apiKeysService.list(user.organizationId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke an API key' })
  @ApiOkResponse({ description: 'API key revoked' })
  async revoke(
    @CurrentUser() user: CurrentUserInterface,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    await this.apiKeysService.revoke(id, user.organizationId);
    return { message: 'API key revoked' };
  }
}
