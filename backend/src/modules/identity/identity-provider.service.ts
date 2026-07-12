import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { IdentityProviderProtocol } from '@prisma/client';
import { EncryptionService } from '../integrations/security/encryption.service';
import { AuditService } from '../audit/audit.service';
import {
  CreateIdentityProviderDto,
  ImportSamlMetadataDto,
  RotateSamlCertificateDto,
  UpdateIdentityProviderDto,
} from './dto/identity-provider.dto';
import { IdentityProviderEntity } from './entities/identity-provider.entity';
import { IdentityProviderRepository } from './identity-provider.repository';
import { IDENTITY_PROVIDER_PRESETS } from './presets/identity-provider-presets';
import { SamlEngineService } from './saml/saml-engine.service';

@Injectable()
export class IdentityProviderService {
  constructor(
    private readonly repository: IdentityProviderRepository,
    private readonly encryptionService: EncryptionService,
    private readonly samlEngineService: SamlEngineService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    organizationId: string,
    dto: CreateIdentityProviderDto,
  ): Promise<IdentityProviderEntity> {
    if (dto.protocol === IdentityProviderProtocol.SAML && !dto.samlConfiguration) {
      throw new BadRequestException('samlConfiguration is required when protocol is SAML');
    }
    if (dto.protocol === IdentityProviderProtocol.OIDC && !dto.oidcConfiguration) {
      throw new BadRequestException('oidcConfiguration is required when protocol is OIDC');
    }

    const preset = dto.preset ?? 'GENERIC';
    const presetDefinition = IDENTITY_PROVIDER_PRESETS[preset];
    if (presetDefinition.protocol !== dto.protocol) {
      throw new BadRequestException(
        `Preset "${preset}" requires protocol ${presetDefinition.protocol}, not ${dto.protocol}`,
      );
    }

    const entity = await this.repository.create({
      organizationId,
      name: dto.name,
      protocol: dto.protocol,
      preset,
      jitProvisioningEnabled: dto.jitProvisioningEnabled ?? true,
      defaultRoleKey: dto.defaultRoleKey ?? 'member',
      roleMappingRules: dto.roleMappingRules ?? [],
      samlConfiguration: dto.samlConfiguration
        ? {
            idpEntityId: dto.samlConfiguration.idpEntityId,
            idpSsoUrl: dto.samlConfiguration.idpSsoUrl,
            idpSloUrl: dto.samlConfiguration.idpSloUrl,
            idpCertificate: this.encryptionService.encrypt(dto.samlConfiguration.idpCertificate),
            spEntityId: `voltx-org-${organizationId}`,
            signatureAlgorithm: dto.samlConfiguration.signatureAlgorithm,
            wantAssertionsSigned: dto.samlConfiguration.wantAssertionsSigned,
          }
        : undefined,
      oidcConfiguration: dto.oidcConfiguration
        ? {
            issuer: dto.oidcConfiguration.issuer,
            clientId: dto.oidcConfiguration.clientId,
            clientSecret: this.encryptionService.encrypt(dto.oidcConfiguration.clientSecret),
            scopes: dto.oidcConfiguration.scopes ?? presetDefinition.defaultScopes,
            claimsMapping: dto.oidcConfiguration.claimsMapping,
          }
        : undefined,
    });

    await this.auditService.record({
      action: 'create',
      resource: 'identity_provider',
      resourceId: entity.id,
      metadata: { organizationId, protocol: dto.protocol, preset },
    });

    return entity;
  }

  async list(organizationId: string): Promise<IdentityProviderEntity[]> {
    return this.repository.listByOrganization(organizationId);
  }

  async getOrThrow(organizationId: string, id: string): Promise<IdentityProviderEntity> {
    const entity = await this.repository.findByIdInOrg(organizationId, id);
    if (!entity) {
      throw new NotFoundException('Identity provider not found');
    }
    return entity;
  }

  async update(
    organizationId: string,
    id: string,
    dto: UpdateIdentityProviderDto,
  ): Promise<IdentityProviderEntity> {
    await this.getOrThrow(organizationId, id);

    if (dto.isDefault) {
      await this.repository.clearDefaultForOrganization(organizationId, id);
    }

    await this.repository.update(id, {
      name: dto.name,
      status: dto.status,
      isDefault: dto.isDefault,
      jitProvisioningEnabled: dto.jitProvisioningEnabled,
      defaultRoleKey: dto.defaultRoleKey,
      roleMappingRules: dto.roleMappingRules,
    });

    if (dto.samlConfiguration) {
      await this.repository.updateSamlConfiguration(id, {
        ...dto.samlConfiguration,
        idpCertificate: dto.samlConfiguration.idpCertificate
          ? this.encryptionService.encrypt(dto.samlConfiguration.idpCertificate)
          : undefined,
      });
    }
    if (dto.oidcConfiguration) {
      await this.repository.updateOidcConfiguration(id, {
        ...dto.oidcConfiguration,
        clientSecret: dto.oidcConfiguration.clientSecret
          ? this.encryptionService.encrypt(dto.oidcConfiguration.clientSecret)
          : undefined,
      });
    }

    await this.auditService.record({
      action: 'update',
      resource: 'identity_provider',
      resourceId: id,
      metadata: { organizationId },
    });

    return this.getOrThrow(organizationId, id);
  }

  async delete(organizationId: string, id: string): Promise<void> {
    await this.getOrThrow(organizationId, id);
    await this.repository.softDelete(id);
    await this.auditService.record({
      action: 'delete',
      resource: 'identity_provider',
      resourceId: id,
      metadata: { organizationId },
    });
  }

  async importSamlMetadata(
    organizationId: string,
    id: string,
    dto: ImportSamlMetadataDto,
  ): Promise<IdentityProviderEntity> {
    const entity = await this.getOrThrow(organizationId, id);
    if (entity.protocol !== IdentityProviderProtocol.SAML) {
      throw new BadRequestException('Metadata import only applies to SAML identity providers');
    }

    const parsed = this.samlEngineService.parseIdpMetadata(dto.metadataXml);

    await this.repository.updateSamlConfiguration(id, {
      idpEntityId: parsed.idpEntityId,
      idpSsoUrl: parsed.idpSsoUrl,
      idpSloUrl: parsed.idpSloUrl ?? undefined,
      idpCertificate: this.encryptionService.encrypt(parsed.idpCertificate),
      metadataXml: dto.metadataXml,
    });

    await this.auditService.record({
      action: 'import_metadata',
      resource: 'identity_provider',
      resourceId: id,
      metadata: { organizationId },
    });

    return this.getOrThrow(organizationId, id);
  }

  async rotateSamlCertificate(
    organizationId: string,
    id: string,
    dto: RotateSamlCertificateDto,
  ): Promise<IdentityProviderEntity> {
    const entity = await this.getOrThrow(organizationId, id);
    if (entity.protocol !== IdentityProviderProtocol.SAML) {
      throw new BadRequestException('Certificate rotation only applies to SAML identity providers');
    }

    await this.repository.updateSamlConfiguration(id, {
      idpCertificate: this.encryptionService.encrypt(dto.idpCertificate),
      idpCertificateExpiresAt: dto.idpCertificateExpiresAt
        ? new Date(dto.idpCertificateExpiresAt)
        : undefined,
    });

    await this.auditService.record({
      action: 'rotate_certificate',
      resource: 'identity_provider',
      resourceId: id,
      metadata: { organizationId },
    });

    return this.getOrThrow(organizationId, id);
  }

  generateSpMetadataXml(entity: IdentityProviderEntity): string {
    if (!entity.samlConfiguration) {
      throw new BadRequestException('This identity provider is not configured for SAML');
    }
    return this.samlEngineService.generateSpMetadata(entity.samlConfiguration, entity.id);
  }
}
