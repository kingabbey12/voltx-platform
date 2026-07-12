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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AUTH_GUARDS } from '../../common/guards/protected.guards';
import { Permissions } from '../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../permissions/guards/permission.guard';
import {
  CreateScimTokenDto,
  CreateScimTokenResponseDto,
  ScimTokenResponseDto,
} from './dto/scim-token.dto';
import { ScimTokenService } from './scim-token.service';

@ApiTags('Enterprise Identity — SCIM')
@ApiBearerAuth('JWT')
@Controller('organizations/:organizationId/identity/scim-tokens')
export class ScimTokenController {
  constructor(private readonly scimTokenService: ScimTokenService) {}

  @Post()
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('identity.provider.manage')
  @ApiOperation({ summary: 'Issue a new SCIM bearer token for this organization' })
  async create(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() dto: CreateScimTokenDto,
  ): Promise<CreateScimTokenResponseDto> {
    const { entity, token } = await this.scimTokenService.create(organizationId, dto);
    return CreateScimTokenResponseDto.fromEntityAndToken(entity, token);
  }

  @Get()
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('identity.provider.read')
  @ApiOperation({ summary: 'List SCIM tokens configured for this organization' })
  async list(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ): Promise<ScimTokenResponseDto[]> {
    const entities = await this.scimTokenService.list(organizationId);
    return entities.map((entity) => ScimTokenResponseDto.fromEntity(entity));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('identity.provider.manage')
  @ApiOperation({ summary: 'Revoke a SCIM token' })
  async revoke(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    await this.scimTokenService.revoke(organizationId, id);
    return { message: 'SCIM token revoked' };
  }
}
