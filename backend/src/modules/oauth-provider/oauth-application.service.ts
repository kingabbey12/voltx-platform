import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuthApplicationStatus } from '@prisma/client';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { AuditService } from '../audit/audit.service';
import { OutboundHttpGuardService } from '../ai/tools/outbound-http-guard.service';
import { PermissionRepository } from '../permissions/permission.repository';
import { generateApiKeySecret, sha256Hex } from '../security/utils/security-hash.util';
import {
  CreateOAuthApplicationDto,
  CreateOAuthApplicationResponseDto,
  OAuthApplicationResponseDto,
  RotateOAuthApplicationSecretResponseDto,
  UpdateOAuthApplicationDto,
} from './dto/oauth-application.dto';
import { OAuthApplicationRepository } from './oauth-application.repository';

@Injectable()
export class OAuthApplicationService {
  constructor(
    private readonly repository: OAuthApplicationRepository,
    private readonly permissionRepository: PermissionRepository,
    private readonly outboundHttpGuard: OutboundHttpGuardService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async create(
    organizationId: string,
    ownerUserId: string,
    callerPermissions: string[],
    dto: CreateOAuthApplicationDto,
  ): Promise<CreateOAuthApplicationResponseDto> {
    this.tenantContextService.assertOrganizationAccess(organizationId);
    await this.assertScopesAreValid(dto.scopes, callerPermissions);
    await this.assertRedirectUrisAreSafe(dto.redirectUris);

    const clientId = `client_${randomBytes(16).toString('hex')}`;
    const prefixConfig = this.configService.get<string>(
      'developerPlatform.oauthClientSecretPrefix',
      'vcs',
    );
    const secret = generateApiKeySecret();
    const rawSecret = `${prefixConfig}_${secret}`;
    const clientSecretHash = sha256Hex(rawSecret);
    const clientSecretPrefix = `${prefixConfig}_${secret.slice(0, 8)}...`;

    const entity = await this.repository.create({
      organizationId,
      ownerUserId,
      name: dto.name,
      description: dto.description,
      logoUrl: dto.logoUrl,
      clientId,
      clientSecretHash,
      clientSecretPrefix,
      scopes: dto.scopes,
      redirectUris: dto.redirectUris,
    });

    await this.auditService.record({
      action: 'oauth_application.created',
      resource: 'oauth_application',
      resourceId: entity.id,
      metadata: { name: dto.name, scopes: dto.scopes },
    });

    return {
      ...OAuthApplicationResponseDto.fromEntity(
        entity,
        entity.redirectUris.map((r) => r.uri),
      ),
      clientSecret: rawSecret,
    };
  }

  async list(organizationId: string): Promise<OAuthApplicationResponseDto[]> {
    this.tenantContextService.assertOrganizationAccess(organizationId);
    const entities = await this.repository.listByOrganization(organizationId);
    return entities.map((entity) =>
      OAuthApplicationResponseDto.fromEntity(
        entity,
        entity.redirectUris.map((r) => r.uri),
      ),
    );
  }

  async getOrThrow(id: string, organizationId: string): Promise<OAuthApplicationResponseDto> {
    this.tenantContextService.assertOrganizationAccess(organizationId);
    const entity = await this.repository.findByIdInOrganization(id, organizationId);
    if (!entity) {
      throw new NotFoundException('OAuth application not found');
    }
    return OAuthApplicationResponseDto.fromEntity(
      entity,
      entity.redirectUris.map((r) => r.uri),
    );
  }

  async update(
    id: string,
    organizationId: string,
    callerPermissions: string[],
    dto: UpdateOAuthApplicationDto,
  ): Promise<OAuthApplicationResponseDto> {
    this.tenantContextService.assertOrganizationAccess(organizationId);
    const existing = await this.repository.findByIdInOrganization(id, organizationId);
    if (!existing) {
      throw new NotFoundException('OAuth application not found');
    }

    if (dto.scopes) {
      await this.assertScopesAreValid(dto.scopes, callerPermissions);
    }
    if (dto.redirectUris) {
      await this.assertRedirectUrisAreSafe(dto.redirectUris);
      await this.repository.replaceRedirectUris(id, dto.redirectUris);
    }

    const entity = await this.repository.update(id, {
      name: dto.name,
      description: dto.description,
      logoUrl: dto.logoUrl,
      scopes: dto.scopes,
    });

    await this.auditService.record({
      action: 'oauth_application.updated',
      resource: 'oauth_application',
      resourceId: id,
    });

    const redirectUris = dto.redirectUris ?? existing.redirectUris.map((r) => r.uri);
    return OAuthApplicationResponseDto.fromEntity(entity, redirectUris);
  }

  async rotateSecret(
    id: string,
    organizationId: string,
  ): Promise<RotateOAuthApplicationSecretResponseDto> {
    this.tenantContextService.assertOrganizationAccess(organizationId);
    const existing = await this.repository.findByIdInOrganization(id, organizationId);
    if (!existing) {
      throw new NotFoundException('OAuth application not found');
    }

    const prefixConfig = this.configService.get<string>(
      'developerPlatform.oauthClientSecretPrefix',
      'vcs',
    );
    const secret = generateApiKeySecret();
    const rawSecret = `${prefixConfig}_${secret}`;
    const clientSecretHash = sha256Hex(rawSecret);
    const clientSecretPrefix = `${prefixConfig}_${secret.slice(0, 8)}...`;

    await this.repository.rotateSecret(id, clientSecretHash, clientSecretPrefix);

    await this.auditService.record({
      action: 'oauth_application.secret_rotated',
      resource: 'oauth_application',
      resourceId: id,
    });

    return { clientSecretPrefix, clientSecret: rawSecret };
  }

  async setStatus(
    id: string,
    organizationId: string,
    status: OAuthApplicationStatus,
  ): Promise<OAuthApplicationResponseDto> {
    this.tenantContextService.assertOrganizationAccess(organizationId);
    const existing = await this.repository.findByIdInOrganization(id, organizationId);
    if (!existing) {
      throw new NotFoundException('OAuth application not found');
    }

    const entity = await this.repository.setStatus(id, status);
    await this.auditService.record({
      action:
        status === OAuthApplicationStatus.SUSPENDED
          ? 'oauth_application.suspended'
          : 'oauth_application.reactivated',
      resource: 'oauth_application',
      resourceId: id,
    });

    return OAuthApplicationResponseDto.fromEntity(
      entity,
      existing.redirectUris.map((r) => r.uri),
    );
  }

  async delete(id: string, organizationId: string): Promise<void> {
    this.tenantContextService.assertOrganizationAccess(organizationId);
    const existing = await this.repository.findByIdInOrganization(id, organizationId);
    if (!existing) {
      throw new NotFoundException('OAuth application not found');
    }

    await this.repository.delete(id);
    await this.auditService.record({
      action: 'oauth_application.deleted',
      resource: 'oauth_application',
      resourceId: id,
    });
  }

  /** An OAuth application must never be registered to request more than its
   * registering user currently holds — the same anti-escalation rule
   * ApiKeysService/ServiceAccountService already enforce. */
  private async assertScopesAreValid(
    requested: string[],
    callerPermissions: string[],
  ): Promise<void> {
    const notHeldByCaller = requested.filter((key) => !callerPermissions.includes(key));
    if (notHeldByCaller.length > 0) {
      throw new ForbiddenException(
        `Cannot register an app scoped to permissions you don't hold: ${notHeldByCaller.join(', ')}`,
      );
    }

    const allPermissions = await this.permissionRepository.findAll();
    const knownKeys = new Set(allPermissions.map((permission) => permission.key));
    const unknown = requested.filter((key) => !knownKeys.has(key));
    if (unknown.length > 0) {
      throw new BadRequestException(`Unknown permission key(s): ${unknown.join(', ')}`);
    }
  }

  /** Every redirect URI is attacker-influenced (a malicious "developer"
   * could register one pointing at internal infrastructure) — reuses the
   * same SSRF-prevention check as AI tool outbound requests. Non-loopback
   * URIs must be https, matching RFC 8252 guidance for native/third-party
   * app redirect URIs. */
  private async assertRedirectUrisAreSafe(uris: string[]): Promise<void> {
    const seen = new Set<string>();
    for (const uri of uris) {
      if (seen.has(uri)) {
        throw new BadRequestException(`Duplicate redirect URI: ${uri}`);
      }
      seen.add(uri);

      await this.outboundHttpGuard.assertUrlIsSafeDestination(uri);

      const parsed = new URL(uri);
      const isLoopback = ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
      if (parsed.protocol !== 'https:' && !isLoopback) {
        throw new BadRequestException(
          `Redirect URI "${uri}" must use https (plain http is only allowed for loopback addresses during local development)`,
        );
      }
    }
  }
}
