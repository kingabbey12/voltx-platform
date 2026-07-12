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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { AUTH_GUARDS } from '../../common/guards/protected.guards';
import { Permissions } from '../permissions/decorators/permissions.decorator';
import { PermissionGuard } from '../permissions/guards/permission.guard';
import {
  CreateIdentityProviderDto,
  IdentityProviderResponseDto,
  ImportSamlMetadataDto,
  RotateSamlCertificateDto,
  UpdateIdentityProviderDto,
} from './dto/identity-provider.dto';
import { IdentityProviderEntity } from './entities/identity-provider.entity';
import { IdentityProviderService } from './identity-provider.service';
import { OidcEngineService } from './oidc/oidc-engine.service';
import { SamlEngineService } from './saml/saml-engine.service';

@ApiTags('Enterprise Identity')
@ApiBearerAuth('JWT')
@Controller('organizations/:organizationId/identity/providers')
export class IdentityController {
  constructor(
    private readonly identityProviderService: IdentityProviderService,
    private readonly samlEngineService: SamlEngineService,
    private readonly oidcEngineService: OidcEngineService,
    private readonly configService: ConfigService,
  ) {}

  @Post()
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('identity.provider.manage')
  @ApiOperation({ summary: 'Configure a new SAML or OIDC identity provider for this organization' })
  async create(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body() dto: CreateIdentityProviderDto,
  ): Promise<IdentityProviderResponseDto> {
    const entity = await this.identityProviderService.create(organizationId, dto);
    return this.toResponseDto(entity);
  }

  @Get()
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('identity.provider.read')
  @ApiOperation({ summary: 'List identity providers configured for this organization' })
  async list(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ): Promise<IdentityProviderResponseDto[]> {
    const entities = await this.identityProviderService.list(organizationId);
    return entities.map((entity) => this.toResponseDto(entity));
  }

  @Get(':id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('identity.provider.read')
  @ApiOperation({ summary: 'Get one identity provider' })
  async getOne(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<IdentityProviderResponseDto> {
    const entity = await this.identityProviderService.getOrThrow(organizationId, id);
    return this.toResponseDto(entity);
  }

  @Patch(':id')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('identity.provider.manage')
  @ApiOperation({ summary: 'Update an identity provider' })
  async update(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateIdentityProviderDto,
  ): Promise<IdentityProviderResponseDto> {
    const entity = await this.identityProviderService.update(organizationId, id, dto);
    return this.toResponseDto(entity);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('identity.provider.manage')
  @ApiOperation({ summary: 'Disable and soft-delete an identity provider' })
  async remove(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ message: string }> {
    await this.identityProviderService.delete(organizationId, id);
    return { message: 'Identity provider deleted' };
  }

  @Post(':id/saml/metadata/import')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('identity.provider.manage')
  @ApiOperation({
    summary: "Import the IdP's SAML metadata XML to populate SSO/certificate fields",
  })
  async importSamlMetadata(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ImportSamlMetadataDto,
  ): Promise<IdentityProviderResponseDto> {
    const entity = await this.identityProviderService.importSamlMetadata(organizationId, id, dto);
    return this.toResponseDto(entity);
  }

  @Post(':id/saml/certificate/rotate')
  @UseGuards(...AUTH_GUARDS, PermissionGuard)
  @Permissions('identity.provider.manage')
  @ApiOperation({ summary: "Rotate the IdP's SAML signing certificate" })
  async rotateSamlCertificate(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RotateSamlCertificateDto,
  ): Promise<IdentityProviderResponseDto> {
    const entity = await this.identityProviderService.rotateSamlCertificate(
      organizationId,
      id,
      dto,
    );
    return this.toResponseDto(entity);
  }

  private toResponseDto(entity: IdentityProviderEntity): IdentityProviderResponseDto {
    const base = this.configService
      .get<string>('integrations.webhookBaseUrl', '')
      .replace(/\/$/, '');
    const loginUrl =
      entity.protocol === 'SAML'
        ? `${base}/api/v1/auth/sso/saml/${entity.id}/login`
        : `${base}/api/v1/auth/sso/oidc/${entity.id}/login`;

    return IdentityProviderResponseDto.fromEntity(entity, {
      loginUrl,
      spAcsUrl: this.samlEngineService.buildAcsUrl(entity.id),
      oidcRedirectUri: this.oidcEngineService.buildRedirectUri(entity.id),
    });
  }
}
