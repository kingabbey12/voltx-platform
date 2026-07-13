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
import { ServiceAccountStatus } from '@prisma/client';
import { ApiSuccessResponseDto } from '../../common/dto/api-response.dto';
import { AUTH_GUARDS } from '../../common/guards/protected.guards';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentUser as CurrentUserInterface } from '../auth/interfaces/current-user.interface';
import { Permissions } from '../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../permissions/guards/permission.guard';
import {
  CreateServiceAccountDto,
  CreateServiceAccountTokenDto,
  CreateServiceAccountTokenResponseDto,
  ServiceAccountResponseDto,
  ServiceAccountTokenResponseDto,
} from './dto/service-account.dto';
import { ServiceAccountService } from './service-account.service';

class ServiceAccountSuccessResponseDto extends ApiSuccessResponseDto<ServiceAccountResponseDto> {}
class ServiceAccountListSuccessResponseDto extends ApiSuccessResponseDto<
  ServiceAccountResponseDto[]
> {}
class ServiceAccountTokenSuccessResponseDto extends ApiSuccessResponseDto<CreateServiceAccountTokenResponseDto> {}
class ServiceAccountTokenListSuccessResponseDto extends ApiSuccessResponseDto<
  ServiceAccountTokenResponseDto[]
> {}

@ApiTags('Developer Platform — Service Accounts')
@ApiBearerAuth('JWT')
@Controller('organizations/:organizationId/service-accounts')
@UseGuards(...AUTH_GUARDS, PermissionGuard)
export class ServiceAccountController {
  constructor(private readonly service: ServiceAccountService) {}

  @Post()
  @Permissions('developer_platform.service_account.manage')
  @ApiOperation({ summary: 'Create a service account for machine-to-machine access' })
  @ApiCreatedResponse({
    description: 'Service account created',
    type: ServiceAccountSuccessResponseDto,
  })
  create(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @CurrentUser() user: CurrentUserInterface,
    @Body() dto: CreateServiceAccountDto,
  ): Promise<ServiceAccountResponseDto> {
    return this.service.create(organizationId, user.id, user.permissions, dto);
  }

  @Get()
  @Permissions('developer_platform.service_account.read')
  @ApiOperation({ summary: "List the organization's service accounts" })
  @ApiOkResponse({ description: 'Service accounts', type: ServiceAccountListSuccessResponseDto })
  list(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ): Promise<ServiceAccountResponseDto[]> {
    return this.service.list(organizationId);
  }

  @Get(':id')
  @Permissions('developer_platform.service_account.read')
  @ApiOperation({ summary: 'Get a service account by id' })
  @ApiOkResponse({ description: 'Service account', type: ServiceAccountSuccessResponseDto })
  getOne(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ServiceAccountResponseDto> {
    return this.service.getOrThrow(id, organizationId);
  }

  @Post(':id/suspend')
  @HttpCode(HttpStatus.OK)
  @Permissions('developer_platform.service_account.manage')
  @ApiOperation({
    summary: 'Suspend a service account (its tokens stop authenticating immediately)',
  })
  @ApiOkResponse({
    description: 'Service account suspended',
    type: ServiceAccountSuccessResponseDto,
  })
  suspend(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ServiceAccountResponseDto> {
    return this.service.setStatus(id, organizationId, ServiceAccountStatus.SUSPENDED);
  }

  @Post(':id/reactivate')
  @HttpCode(HttpStatus.OK)
  @Permissions('developer_platform.service_account.manage')
  @ApiOperation({ summary: 'Reactivate a suspended service account' })
  @ApiOkResponse({
    description: 'Service account reactivated',
    type: ServiceAccountSuccessResponseDto,
  })
  reactivate(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ServiceAccountResponseDto> {
    return this.service.setStatus(id, organizationId, ServiceAccountStatus.ACTIVE);
  }

  @Post(':id/tokens')
  @Permissions('developer_platform.service_account.manage')
  @ApiOperation({
    summary: 'Issue a new token for a service account',
    description: 'The full token is returned exactly once in this response and never again.',
  })
  @ApiCreatedResponse({
    description: 'Service account token created',
    type: ServiceAccountTokenSuccessResponseDto,
  })
  createToken(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateServiceAccountTokenDto,
  ): Promise<CreateServiceAccountTokenResponseDto> {
    return this.service.createToken(id, organizationId, dto);
  }

  @Get(':id/tokens')
  @Permissions('developer_platform.service_account.read')
  @ApiOperation({ summary: "List a service account's tokens (redacted)" })
  @ApiOkResponse({
    description: 'Service account tokens',
    type: ServiceAccountTokenListSuccessResponseDto,
  })
  listTokens(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ServiceAccountTokenResponseDto[]> {
    return this.service.listTokens(id, organizationId);
  }

  @Delete(':id/tokens/:tokenId')
  @HttpCode(HttpStatus.OK)
  @Permissions('developer_platform.service_account.manage')
  @ApiOperation({ summary: "Revoke a service account's token" })
  @ApiOkResponse({ description: 'Token revoked' })
  async revokeToken(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('tokenId', ParseUUIDPipe) tokenId: string,
  ): Promise<{ message: string }> {
    await this.service.revokeToken(id, tokenId, organizationId);
    return { message: 'Token revoked' };
  }
}
