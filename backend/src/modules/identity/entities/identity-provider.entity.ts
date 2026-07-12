import {
  IdentityProvider,
  IdentityProviderPreset,
  IdentityProviderProtocol,
  IdentityProviderStatus,
  OidcConfiguration,
  SamlConfiguration,
} from '@prisma/client';

export interface RoleMappingRule {
  sourceValue: string;
  roleKey: string;
}

export interface IdentityProviderEntity {
  id: string;
  organizationId: string;
  name: string;
  protocol: IdentityProviderProtocol;
  preset: IdentityProviderPreset;
  status: IdentityProviderStatus;
  isDefault: boolean;
  jitProvisioningEnabled: boolean;
  defaultRoleKey: string;
  roleMappingRules: RoleMappingRule[];
  createdAt: Date;
  updatedAt: Date;
  samlConfiguration: SamlConfigurationEntity | null;
  oidcConfiguration: OidcConfigurationEntity | null;
}

export interface SamlConfigurationEntity {
  id: string;
  identityProviderId: string;
  idpEntityId: string;
  idpSsoUrl: string;
  idpSloUrl: string | null;
  /** Encrypted at rest — decrypt via EncryptionService before use. */
  idpCertificate: string;
  idpCertificateExpiresAt: Date | null;
  spEntityId: string;
  signatureAlgorithm: string;
  wantAssertionsSigned: boolean;
  metadataXml: string | null;
}

export interface OidcConfigurationEntity {
  id: string;
  identityProviderId: string;
  issuer: string;
  clientId: string;
  /** Encrypted at rest — decrypt via EncryptionService before use. */
  clientSecret: string;
  authorizationEndpoint: string | null;
  tokenEndpoint: string | null;
  userinfoEndpoint: string | null;
  jwksUri: string | null;
  scopes: string[];
  claimsMapping: Record<string, string>;
}

type IdentityProviderRecord = IdentityProvider & {
  samlConfiguration: SamlConfiguration | null;
  oidcConfiguration: OidcConfiguration | null;
};

export function toIdentityProviderEntity(record: IdentityProviderRecord): IdentityProviderEntity {
  return {
    id: record.id,
    organizationId: record.organizationId,
    name: record.name,
    protocol: record.protocol,
    preset: record.preset,
    status: record.status,
    isDefault: record.isDefault,
    jitProvisioningEnabled: record.jitProvisioningEnabled,
    defaultRoleKey: record.defaultRoleKey,
    roleMappingRules: Array.isArray(record.roleMappingRules)
      ? (record.roleMappingRules as unknown as RoleMappingRule[])
      : [],
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    samlConfiguration: record.samlConfiguration
      ? toSamlConfigurationEntity(record.samlConfiguration)
      : null,
    oidcConfiguration: record.oidcConfiguration
      ? toOidcConfigurationEntity(record.oidcConfiguration)
      : null,
  };
}

export function toSamlConfigurationEntity(record: SamlConfiguration): SamlConfigurationEntity {
  return {
    id: record.id,
    identityProviderId: record.identityProviderId,
    idpEntityId: record.idpEntityId,
    idpSsoUrl: record.idpSsoUrl,
    idpSloUrl: record.idpSloUrl,
    idpCertificate: record.idpCertificate,
    idpCertificateExpiresAt: record.idpCertificateExpiresAt,
    spEntityId: record.spEntityId,
    signatureAlgorithm: record.signatureAlgorithm,
    wantAssertionsSigned: record.wantAssertionsSigned,
    metadataXml: record.metadataXml,
  };
}

export function toOidcConfigurationEntity(record: OidcConfiguration): OidcConfigurationEntity {
  return {
    id: record.id,
    identityProviderId: record.identityProviderId,
    issuer: record.issuer,
    clientId: record.clientId,
    clientSecret: record.clientSecret,
    authorizationEndpoint: record.authorizationEndpoint,
    tokenEndpoint: record.tokenEndpoint,
    userinfoEndpoint: record.userinfoEndpoint,
    jwksUri: record.jwksUri,
    scopes: record.scopes,
    claimsMapping: (record.claimsMapping as Record<string, string>) ?? {},
  };
}
