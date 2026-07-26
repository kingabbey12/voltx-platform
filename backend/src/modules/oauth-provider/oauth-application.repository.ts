import { Injectable } from '@nestjs/common';
import { OAuthApplicationStatus } from '@prisma/client';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../database/prisma.service';
import {
  OAuthApplicationEntity,
  OAuthApplicationWithRedirectUrisEntity,
  toOAuthApplicationEntity,
  toOAuthRedirectUriEntity,
} from './entities/oauth-application.entity';

export interface CreateOAuthApplicationData {
  organizationId: string;
  ownerUserId: string;
  name: string;
  description?: string;
  logoUrl?: string;
  clientId: string;
  clientSecretHash: string;
  clientSecretPrefix: string;
  scopes: string[];
  redirectUris: string[];
}

export interface UpdateOAuthApplicationData {
  name?: string;
  description?: string;
  logoUrl?: string;
  scopes?: string[];
}

@Injectable()
export class OAuthApplicationRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async create(data: CreateOAuthApplicationData): Promise<OAuthApplicationWithRedirectUrisEntity> {
    return this.prisma.runInTransaction(async (tx) => {
      const application = await tx.oAuthApplication.create({
        data: {
          organizationId: data.organizationId,
          ownerUserId: data.ownerUserId,
          name: data.name,
          description: data.description,
          logoUrl: data.logoUrl,
          clientId: data.clientId,
          clientSecretHash: data.clientSecretHash,
          clientSecretPrefix: data.clientSecretPrefix,
          scopes: data.scopes,
        },
      });

      const redirectUris = await Promise.all(
        data.redirectUris.map((uri) =>
          tx.oAuthRedirectUri.create({ data: { applicationId: application.id, uri } }),
        ),
      );

      return {
        ...toOAuthApplicationEntity(application),
        redirectUris: redirectUris.map(toOAuthRedirectUriEntity),
      };
    });
  }

  async listByOrganization(
    organizationId: string,
  ): Promise<OAuthApplicationWithRedirectUrisEntity[]> {
    const records = await this.prisma.system.oAuthApplication.findMany({
      where: { organizationId },
      include: { redirectUris: true },
      orderBy: { createdAt: 'desc' },
    });
    return records.map((record) => ({
      ...toOAuthApplicationEntity(record),
      redirectUris: record.redirectUris.map(toOAuthRedirectUriEntity),
    }));
  }

  async findByIdInOrganization(
    id: string,
    organizationId: string,
  ): Promise<OAuthApplicationWithRedirectUrisEntity | null> {
    const record = await this.prisma.system.oAuthApplication.findFirst({
      where: { id, organizationId },
      include: { redirectUris: true },
    });
    if (!record) return null;
    return {
      ...toOAuthApplicationEntity(record),
      redirectUris: record.redirectUris.map(toOAuthRedirectUriEntity),
    };
  }

  /** Unscoped — used only by the authorize/token/introspect/revoke flows,
   * which authenticate the application via its client_id/client_secret
   * before any organization context is known. */
  async findActiveByClientId(
    clientId: string,
  ): Promise<OAuthApplicationWithRedirectUrisEntity | null> {
    const record = await this.prisma.system.oAuthApplication.findFirst({
      where: { clientId, status: OAuthApplicationStatus.ACTIVE },
      include: { redirectUris: true },
    });
    if (!record) return null;
    return {
      ...toOAuthApplicationEntity(record),
      redirectUris: record.redirectUris.map(toOAuthRedirectUriEntity),
    };
  }

  async update(id: string, data: UpdateOAuthApplicationData): Promise<OAuthApplicationEntity> {
    const tenant = this.tenantContextService.get();
    const where = tenant?.organizationId ? { id, organizationId: tenant.organizationId } : { id };
    const record = await this.prisma.system.oAuthApplication.update({
      where,
      data,
    });
    return toOAuthApplicationEntity(record);
  }

  /** Replaces the full set of redirect URIs — simplest correct semantics
   * for "update the registered redirect URIs" without a proliferation of
   * per-URI sub-resource endpoints. */
  async replaceRedirectUris(applicationId: string, uris: string[]): Promise<void> {
    await this.prisma.runInTransaction(async (tx) => {
      await tx.oAuthRedirectUri.deleteMany({ where: { applicationId } });
      await Promise.all(
        uris.map((uri) => tx.oAuthRedirectUri.create({ data: { applicationId, uri } })),
      );
    });
  }

  async rotateSecret(
    id: string,
    clientSecretHash: string,
    clientSecretPrefix: string,
  ): Promise<OAuthApplicationEntity> {
    const tenant = this.tenantContextService.get();
    const where = tenant?.organizationId ? { id, organizationId: tenant.organizationId } : { id };
    const record = await this.prisma.system.oAuthApplication.update({
      where,
      data: { clientSecretHash, clientSecretPrefix },
    });
    return toOAuthApplicationEntity(record);
  }

  async setStatus(id: string, status: OAuthApplicationStatus): Promise<OAuthApplicationEntity> {
    const tenant = this.tenantContextService.get();
    const where = tenant?.organizationId ? { id, organizationId: tenant.organizationId } : { id };
    const record = await this.prisma.system.oAuthApplication.update({
      where,
      data: { status },
    });
    return toOAuthApplicationEntity(record);
  }

  async delete(id: string): Promise<void> {
    const tenant = this.tenantContextService.get();
    const where = tenant?.organizationId ? { id, organizationId: tenant.organizationId } : { id };
    await this.prisma.system.oAuthApplication.delete({ where });
  }
}
