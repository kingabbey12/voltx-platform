import { Injectable } from '@nestjs/common';
import {
  IdentityProviderPreset,
  IdentityProviderProtocol,
  IdentityProviderStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  IdentityProviderEntity,
  RoleMappingRule,
  toIdentityProviderEntity,
} from './entities/identity-provider.entity';

const INCLUDE = {
  samlConfiguration: true,
  oidcConfiguration: true,
} satisfies Prisma.IdentityProviderInclude;

export interface CreateIdentityProviderData {
  organizationId: string;
  name: string;
  protocol: IdentityProviderProtocol;
  preset: IdentityProviderPreset;
  jitProvisioningEnabled: boolean;
  defaultRoleKey: string;
  roleMappingRules: RoleMappingRule[];
  samlConfiguration?: {
    idpEntityId: string;
    idpSsoUrl: string;
    idpSloUrl?: string;
    idpCertificate: string;
    idpCertificateExpiresAt?: Date;
    spEntityId: string;
    signatureAlgorithm?: string;
    wantAssertionsSigned?: boolean;
    metadataXml?: string;
  };
  oidcConfiguration?: {
    issuer: string;
    clientId: string;
    clientSecret: string;
    authorizationEndpoint?: string;
    tokenEndpoint?: string;
    userinfoEndpoint?: string;
    jwksUri?: string;
    scopes?: string[];
    claimsMapping?: Record<string, string>;
  };
}

export interface UpdateIdentityProviderData {
  name?: string;
  status?: IdentityProviderStatus;
  isDefault?: boolean;
  jitProvisioningEnabled?: boolean;
  defaultRoleKey?: string;
  roleMappingRules?: RoleMappingRule[];
}

@Injectable()
export class IdentityProviderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateIdentityProviderData): Promise<IdentityProviderEntity> {
    const record = await this.prisma.identityProvider.create({
      data: {
        organizationId: data.organizationId,
        name: data.name,
        protocol: data.protocol,
        preset: data.preset,
        jitProvisioningEnabled: data.jitProvisioningEnabled,
        defaultRoleKey: data.defaultRoleKey,
        roleMappingRules: data.roleMappingRules as unknown as Prisma.InputJsonValue,
        samlConfiguration: data.samlConfiguration
          ? {
              create: {
                idpEntityId: data.samlConfiguration.idpEntityId,
                idpSsoUrl: data.samlConfiguration.idpSsoUrl,
                idpSloUrl: data.samlConfiguration.idpSloUrl,
                idpCertificate: data.samlConfiguration.idpCertificate,
                idpCertificateExpiresAt: data.samlConfiguration.idpCertificateExpiresAt,
                spEntityId: data.samlConfiguration.spEntityId,
                signatureAlgorithm: data.samlConfiguration.signatureAlgorithm ?? 'sha256',
                wantAssertionsSigned: data.samlConfiguration.wantAssertionsSigned ?? true,
                metadataXml: data.samlConfiguration.metadataXml,
              },
            }
          : undefined,
        oidcConfiguration: data.oidcConfiguration
          ? {
              create: {
                issuer: data.oidcConfiguration.issuer,
                clientId: data.oidcConfiguration.clientId,
                clientSecret: data.oidcConfiguration.clientSecret,
                authorizationEndpoint: data.oidcConfiguration.authorizationEndpoint,
                tokenEndpoint: data.oidcConfiguration.tokenEndpoint,
                userinfoEndpoint: data.oidcConfiguration.userinfoEndpoint,
                jwksUri: data.oidcConfiguration.jwksUri,
                scopes: data.oidcConfiguration.scopes ?? ['openid', 'email', 'profile'],
                claimsMapping: data.oidcConfiguration.claimsMapping ?? {},
              },
            }
          : undefined,
      },
      include: INCLUDE,
    });

    return toIdentityProviderEntity(record);
  }

  async findByIdInOrg(organizationId: string, id: string): Promise<IdentityProviderEntity | null> {
    const record = await this.prisma.identityProvider.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: INCLUDE,
    });
    return record ? toIdentityProviderEntity(record) : null;
  }

  /** Unscoped — used by the public SSO login/ACS/callback routes, which run before any tenant context exists. */
  async findByIdUnscoped(id: string): Promise<IdentityProviderEntity | null> {
    const record = await this.prisma.system.identityProvider.findFirst({
      where: { id, deletedAt: null },
      include: INCLUDE,
    });
    return record ? toIdentityProviderEntity(record) : null;
  }

  async listByOrganization(organizationId: string): Promise<IdentityProviderEntity[]> {
    const records = await this.prisma.identityProvider.findMany({
      where: { organizationId, deletedAt: null },
      include: INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
    return records.map(toIdentityProviderEntity);
  }

  async update(id: string, data: UpdateIdentityProviderData): Promise<IdentityProviderEntity> {
    const record = await this.prisma.identityProvider.update({
      where: { id },
      data: {
        name: data.name,
        status: data.status,
        isDefault: data.isDefault,
        jitProvisioningEnabled: data.jitProvisioningEnabled,
        defaultRoleKey: data.defaultRoleKey,
        roleMappingRules: data.roleMappingRules
          ? (data.roleMappingRules as unknown as Prisma.InputJsonValue)
          : undefined,
      },
      include: INCLUDE,
    });
    return toIdentityProviderEntity(record);
  }

  async updateSamlConfiguration(
    identityProviderId: string,
    data: Partial<{
      idpEntityId: string;
      idpSsoUrl: string;
      idpSloUrl: string;
      idpCertificate: string;
      idpCertificateExpiresAt: Date;
      signatureAlgorithm: string;
      wantAssertionsSigned: boolean;
      metadataXml: string;
    }>,
  ): Promise<void> {
    await this.prisma.samlConfiguration.update({
      where: { identityProviderId },
      data,
    });
  }

  async updateOidcConfiguration(
    identityProviderId: string,
    data: Partial<{
      issuer: string;
      clientId: string;
      clientSecret: string;
      authorizationEndpoint: string;
      tokenEndpoint: string;
      userinfoEndpoint: string;
      jwksUri: string;
      scopes: string[];
      claimsMapping: Record<string, string>;
    }>,
  ): Promise<void> {
    await this.prisma.oidcConfiguration.update({
      where: { identityProviderId },
      data: {
        ...data,
        claimsMapping: data.claimsMapping
          ? (data.claimsMapping as Prisma.InputJsonValue)
          : undefined,
      },
    });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.identityProvider.update({
      where: { id },
      data: { deletedAt: new Date(), status: IdentityProviderStatus.DISABLED },
    });
  }

  /**
   * Clears isDefault on every other active IdP for the org before the
   * caller sets the new default — enforces "at most one default IdP per
   * organization" without a DB-level partial unique index.
   */
  async clearDefaultForOrganization(organizationId: string, exceptId: string): Promise<void> {
    await this.prisma.identityProvider.updateMany({
      where: { organizationId, id: { not: exceptId }, isDefault: true },
      data: { isDefault: false },
    });
  }
}
