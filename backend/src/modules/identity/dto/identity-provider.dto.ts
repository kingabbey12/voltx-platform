import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  IdentityProviderPreset,
  IdentityProviderProtocol,
  IdentityProviderStatus,
} from '@prisma/client';
import { IdentityProviderEntity, RoleMappingRule } from '../entities/identity-provider.entity';

export class RoleMappingRuleDto implements RoleMappingRule {
  @IsString()
  @MinLength(1)
  sourceValue!: string;

  @IsString()
  @MinLength(1)
  roleKey!: string;
}

export class CreateSamlConfigurationDto {
  @IsString()
  @MinLength(1)
  idpEntityId!: string;

  @IsUrl({ require_tld: false })
  idpSsoUrl!: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  idpSloUrl?: string;

  @IsString()
  @MinLength(1)
  idpCertificate!: string;

  @IsOptional()
  @IsString()
  signatureAlgorithm?: string;

  @IsOptional()
  @IsBoolean()
  wantAssertionsSigned?: boolean;
}

export class CreateOidcConfigurationDto {
  @IsUrl({ require_tld: false })
  issuer!: string;

  @IsString()
  @MinLength(1)
  clientId!: string;

  @IsString()
  @MinLength(1)
  clientSecret!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  scopes?: string[];

  @IsOptional()
  claimsMapping?: Record<string, string>;
}

export class CreateIdentityProviderDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @IsEnum(IdentityProviderProtocol)
  protocol!: IdentityProviderProtocol;

  @IsOptional()
  @IsEnum(IdentityProviderPreset)
  preset?: IdentityProviderPreset;

  @IsOptional()
  @IsBoolean()
  jitProvisioningEnabled?: boolean;

  @IsOptional()
  @IsString()
  defaultRoleKey?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => RoleMappingRuleDto)
  roleMappingRules?: RoleMappingRuleDto[];

  @ValidateIf((dto: CreateIdentityProviderDto) => dto.protocol === IdentityProviderProtocol.SAML)
  @ValidateNested()
  @Type(() => CreateSamlConfigurationDto)
  samlConfiguration?: CreateSamlConfigurationDto;

  @ValidateIf((dto: CreateIdentityProviderDto) => dto.protocol === IdentityProviderProtocol.OIDC)
  @ValidateNested()
  @Type(() => CreateOidcConfigurationDto)
  oidcConfiguration?: CreateOidcConfigurationDto;
}

export class UpdateIdentityProviderDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsEnum(IdentityProviderStatus)
  status?: IdentityProviderStatus;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsBoolean()
  jitProvisioningEnabled?: boolean;

  @IsOptional()
  @IsString()
  defaultRoleKey?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => RoleMappingRuleDto)
  roleMappingRules?: RoleMappingRuleDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateSamlConfigurationDto)
  samlConfiguration?: Partial<CreateSamlConfigurationDto>;

  @IsOptional()
  @ValidateNested()
  @Type(() => CreateOidcConfigurationDto)
  oidcConfiguration?: Partial<CreateOidcConfigurationDto>;
}

export class ImportSamlMetadataDto {
  @IsString()
  @MinLength(1)
  metadataXml!: string;
}

export class RotateSamlCertificateDto {
  @IsString()
  @MinLength(1)
  idpCertificate!: string;

  @IsOptional()
  idpCertificateExpiresAt?: string;
}

export class SamlConfigurationResponseDto {
  idpEntityId!: string;
  idpSsoUrl!: string;
  idpSloUrl!: string | null;
  idpCertificateExpiresAt!: string | null;
  spEntityId!: string;
  spAcsUrl!: string;
  signatureAlgorithm!: string;
  wantAssertionsSigned!: boolean;
  certificateConfigured!: boolean;
}

export class OidcConfigurationResponseDto {
  issuer!: string;
  clientId!: string;
  redirectUri!: string;
  scopes!: string[];
  clientSecretConfigured!: boolean;
}

export class IdentityProviderResponseDto {
  id!: string;
  organizationId!: string;
  name!: string;
  protocol!: IdentityProviderProtocol;
  preset!: IdentityProviderPreset;
  status!: IdentityProviderStatus;
  isDefault!: boolean;
  jitProvisioningEnabled!: boolean;
  defaultRoleKey!: string;
  roleMappingRules!: RoleMappingRule[];
  createdAt!: string;
  updatedAt!: string;
  loginUrl!: string;
  saml!: SamlConfigurationResponseDto | null;
  oidc!: OidcConfigurationResponseDto | null;

  static fromEntity(
    entity: IdentityProviderEntity,
    urls: { loginUrl: string; spAcsUrl: string; oidcRedirectUri: string },
  ): IdentityProviderResponseDto {
    const dto = new IdentityProviderResponseDto();
    dto.id = entity.id;
    dto.organizationId = entity.organizationId;
    dto.name = entity.name;
    dto.protocol = entity.protocol;
    dto.preset = entity.preset;
    dto.status = entity.status;
    dto.isDefault = entity.isDefault;
    dto.jitProvisioningEnabled = entity.jitProvisioningEnabled;
    dto.defaultRoleKey = entity.defaultRoleKey;
    dto.roleMappingRules = entity.roleMappingRules;
    dto.createdAt = entity.createdAt.toISOString();
    dto.updatedAt = entity.updatedAt.toISOString();
    dto.loginUrl = urls.loginUrl;
    dto.saml = entity.samlConfiguration
      ? {
          idpEntityId: entity.samlConfiguration.idpEntityId,
          idpSsoUrl: entity.samlConfiguration.idpSsoUrl,
          idpSloUrl: entity.samlConfiguration.idpSloUrl,
          idpCertificateExpiresAt:
            entity.samlConfiguration.idpCertificateExpiresAt?.toISOString() ?? null,
          spEntityId: entity.samlConfiguration.spEntityId,
          spAcsUrl: urls.spAcsUrl,
          signatureAlgorithm: entity.samlConfiguration.signatureAlgorithm,
          wantAssertionsSigned: entity.samlConfiguration.wantAssertionsSigned,
          certificateConfigured: entity.samlConfiguration.idpCertificate.length > 0,
        }
      : null;
    dto.oidc = entity.oidcConfiguration
      ? {
          issuer: entity.oidcConfiguration.issuer,
          clientId: entity.oidcConfiguration.clientId,
          redirectUri: urls.oidcRedirectUri,
          scopes: entity.oidcConfiguration.scopes,
          clientSecretConfigured: entity.oidcConfiguration.clientSecret.length > 0,
        }
      : null;
    return dto;
  }
}
