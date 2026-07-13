import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
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
import { OAuthApplicationStatus } from '@prisma/client';
import { ApiSuccessResponseDto } from '../../common/dto/api-response.dto';
import { AUTH_GUARDS } from '../../common/guards/protected.guards';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrentUser as CurrentUserInterface } from '../auth/interfaces/current-user.interface';
import { Permissions } from '../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../permissions/guards/permission.guard';
import {
  CreateOAuthApplicationDto,
  CreateOAuthApplicationResponseDto,
  OAuthApplicationResponseDto,
  RotateOAuthApplicationSecretResponseDto,
  UpdateOAuthApplicationDto,
} from './dto/oauth-application.dto';
import { OAuthApplicationService } from './oauth-application.service';

class OAuthApplicationSuccessResponseDto extends ApiSuccessResponseDto<CreateOAuthApplicationResponseDto> {}
class OAuthApplicationDetailSuccessResponseDto extends ApiSuccessResponseDto<OAuthApplicationResponseDto> {}
class OAuthApplicationListSuccessResponseDto extends ApiSuccessResponseDto<
  OAuthApplicationResponseDto[]
> {}
class RotateOAuthApplicationSecretSuccessResponseDto extends ApiSuccessResponseDto<RotateOAuthApplicationSecretResponseDto> {}

@ApiTags('Developer Platform — OAuth Applications')
@ApiBearerAuth('JWT')
@Controller('organizations/:organizationId/oauth-applications')
@UseGuards(...AUTH_GUARDS, PermissionGuard)
export class OAuthApplicationController {
  constructor(private readonly service: OAuthApplicationService) {}

  @Post()
  @Permissions('developer_platform.oauth_application.manage')
  @ApiOperation({ summary: 'Register a new OAuth application' })
  @ApiCreatedResponse({
    description: 'OAuth application registered',
    type: OAuthApplicationSuccessResponseDto,
  })
  create(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @CurrentUser() user: CurrentUserInterface,
    @Body() dto: CreateOAuthApplicationDto,
  ): Promise<CreateOAuthApplicationResponseDto> {
    return this.service.create(organizationId, user.id, user.permissions, dto);
  }

  @Get()
  @Permissions('developer_platform.oauth_application.read')
  @ApiOperation({ summary: "List the organization's registered OAuth applications" })
  @ApiOkResponse({
    description: 'OAuth applications',
    type: OAuthApplicationListSuccessResponseDto,
  })
  list(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ): Promise<OAuthApplicationResponseDto[]> {
    return this.service.list(organizationId);
  }

  @Get(':id')
  @Permissions('developer_platform.oauth_application.read')
  @ApiOperation({ summary: 'Get an OAuth application by id' })
  @ApiOkResponse({
    description: 'OAuth application',
    type: OAuthApplicationDetailSuccessResponseDto,
  })
  getOne(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<OAuthApplicationResponseDto> {
    return this.service.getOrThrow(id, organizationId);
  }

  @Patch(':id')
  @Permissions('developer_platform.oauth_application.manage')
  @ApiOperation({
    summary: 'Update an OAuth application (name, description, logo, redirect URIs, or scopes)',
  })
  @ApiOkResponse({
    description: 'OAuth application updated',
    type: OAuthApplicationDetailSuccessResponseDto,
  })
  update(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: CurrentUserInterface,
    @Body() dto: UpdateOAuthApplicationDto,
  ): Promise<OAuthApplicationResponseDto> {
    return this.service.update(id, organizationId, user.permissions, dto);
  }

  @Post(':id/rotate-secret')
  @Permissions('developer_platform.oauth_application.manage')
  @ApiOperation({
    summary: "Rotate an OAuth application's client secret",
    description: 'The full new secret is returned exactly once in this response and never again.',
  })
  @ApiOkResponse({
    description: 'Client secret rotated',
    type: RotateOAuthApplicationSecretSuccessResponseDto,
  })
  rotateSecret(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<RotateOAuthApplicationSecretResponseDto> {
    return this.service.rotateSecret(id, organizationId);
  }

  @Post(':id/suspend')
  @HttpCode(HttpStatus.OK)
  @Permissions('developer_platform.oauth_application.manage')
  @ApiOperation({
    summary:
      'Suspend an OAuth application (it can no longer authorize, exchange, or refresh tokens)',
  })
  @ApiOkResponse({
    description: 'OAuth application suspended',
    type: OAuthApplicationDetailSuccessResponseDto,
  })
  suspend(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<OAuthApplicationResponseDto> {
    return this.service.setStatus(id, organizationId, OAuthApplicationStatus.SUSPENDED);
  }

  @Post(':id/reactivate')
  @HttpCode(HttpStatus.OK)
  @Permissions('developer_platform.oauth_application.manage')
  @ApiOperation({ summary: 'Reactivate a suspended OAuth application' })
  @ApiOkResponse({
    description: 'OAuth application reactivated',
    type: OAuthApplicationDetailSuccessResponseDto,
  })
  reactivate(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<OAuthApplicationResponseDto> {
    return this.service.setStatus(id, organizationId, OAuthApplicationStatus.ACTIVE);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @Permissions('developer_platform.oauth_application.manage')
  @ApiOperation({
    summary: 'Delete an OAuth application (revokes every code and token it ever issued)',
  })
  @ApiOkResponse({ description: 'OAuth application deleted' })
  async delete(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    await this.service.delete(id, organizationId);
    return { message: 'OAuth application deleted' };
  }
}
