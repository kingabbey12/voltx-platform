import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ServiceAccountStatus } from '@prisma/client';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { AuditService } from '../audit/audit.service';
import { PermissionService } from '../permissions/permission.service';
import { RoleRepository } from '../roles/role.repository';
import { generateApiKeySecret, sha256Hex } from '../security/utils/security-hash.util';
import {
  CreateServiceAccountDto,
  CreateServiceAccountTokenDto,
  CreateServiceAccountTokenResponseDto,
  ServiceAccountResponseDto,
  ServiceAccountTokenResponseDto,
} from './dto/service-account.dto';
import { ServiceAccountRepository } from './service-account.repository';

@Injectable()
export class ServiceAccountService {
  constructor(
    private readonly repository: ServiceAccountRepository,
    private readonly roleRepository: RoleRepository,
    private readonly permissionService: PermissionService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async create(
    organizationId: string,
    createdByUserId: string,
    callerPermissions: string[],
    dto: CreateServiceAccountDto,
  ): Promise<ServiceAccountResponseDto> {
    this.tenantContextService.assertOrganizationAccess(organizationId);
    const role = await this.roleRepository.findById(dto.roleId);
    if (!role) {
      throw new BadRequestException('Unknown role');
    }

    // A service account must never be granted more than its creator
    // currently holds — the exact same anti-escalation rule ApiKeysService
    // already enforces for API keys.
    const rolePermissions = await this.permissionService.getPermissionKeysForRole(role.id);
    const notHeldByCaller = rolePermissions.filter((key) => !callerPermissions.includes(key));
    if (notHeldByCaller.length > 0) {
      throw new ForbiddenException(
        `Cannot grant a role with permissions you don't hold: ${notHeldByCaller.join(', ')}`,
      );
    }

    const entity = await this.repository.create({
      organizationId,
      name: dto.name,
      description: dto.description,
      roleId: dto.roleId,
      createdByUserId,
    });

    await this.auditService.record({
      action: 'service_account.created',
      resource: 'service_account',
      resourceId: entity.id,
      metadata: { name: dto.name, roleId: dto.roleId },
    });

    return ServiceAccountResponseDto.fromEntity(entity);
  }

  async list(organizationId: string): Promise<ServiceAccountResponseDto[]> {
    this.tenantContextService.assertOrganizationAccess(organizationId);
    const entities = await this.repository.listByOrganization(organizationId);
    return entities.map((entity) => ServiceAccountResponseDto.fromEntity(entity));
  }

  async getOrThrow(id: string, organizationId: string): Promise<ServiceAccountResponseDto> {
    this.tenantContextService.assertOrganizationAccess(organizationId);
    const entity = await this.repository.findByIdInOrganization(id, organizationId);
    if (!entity) {
      throw new NotFoundException('Service account not found');
    }
    return ServiceAccountResponseDto.fromEntity(entity);
  }

  async setStatus(
    id: string,
    organizationId: string,
    status: ServiceAccountStatus,
  ): Promise<ServiceAccountResponseDto> {
    this.tenantContextService.assertOrganizationAccess(organizationId);
    const existing = await this.repository.findByIdInOrganization(id, organizationId);
    if (!existing) {
      throw new NotFoundException('Service account not found');
    }
    const entity = await this.repository.setStatus(id, status);
    await this.auditService.record({
      action:
        status === ServiceAccountStatus.SUSPENDED
          ? 'service_account.suspended'
          : 'service_account.reactivated',
      resource: 'service_account',
      resourceId: id,
    });
    return ServiceAccountResponseDto.fromEntity(entity);
  }

  async createToken(
    id: string,
    organizationId: string,
    dto: CreateServiceAccountTokenDto,
  ): Promise<CreateServiceAccountTokenResponseDto> {
    this.tenantContextService.assertOrganizationAccess(organizationId);
    const serviceAccount = await this.repository.findByIdInOrganization(id, organizationId);
    if (!serviceAccount) {
      throw new NotFoundException('Service account not found');
    }
    if (serviceAccount.status !== ServiceAccountStatus.ACTIVE) {
      throw new ForbiddenException('Cannot issue a token for a suspended service account');
    }

    const prefixConfig = this.configService.get<string>(
      'developerPlatform.serviceAccountTokenPrefix',
      'vsa',
    );
    const secret = generateApiKeySecret();
    const rawToken = `${prefixConfig}_${secret}`;
    const tokenHash = sha256Hex(rawToken);
    const tokenPrefix = `${prefixConfig}_${secret.slice(0, 8)}...`;

    const entity = await this.repository.createToken({
      serviceAccountId: id,
      name: dto.name,
      tokenHash,
      tokenPrefix,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
    });

    await this.auditService.record({
      action: 'service_account.token_created',
      resource: 'service_account',
      resourceId: id,
      metadata: { tokenId: entity.id },
    });

    return { ...ServiceAccountTokenResponseDto.fromEntity(entity), token: rawToken };
  }

  async listTokens(id: string, organizationId: string): Promise<ServiceAccountTokenResponseDto[]> {
    this.tenantContextService.assertOrganizationAccess(organizationId);
    const serviceAccount = await this.repository.findByIdInOrganization(id, organizationId);
    if (!serviceAccount) {
      throw new NotFoundException('Service account not found');
    }
    const tokens = await this.repository.listTokens(id);
    return tokens.map((token) => ServiceAccountTokenResponseDto.fromEntity(token));
  }

  async revokeToken(id: string, tokenId: string, organizationId: string): Promise<void> {
    this.tenantContextService.assertOrganizationAccess(organizationId);
    const serviceAccount = await this.repository.findByIdInOrganization(id, organizationId);
    if (!serviceAccount) {
      throw new NotFoundException('Service account not found');
    }
    const token = await this.repository.findTokenByIdForAccount(tokenId, id);
    if (!token) {
      throw new NotFoundException('Token not found');
    }
    if (token.revokedAt) {
      throw new ForbiddenException('Token already revoked');
    }
    await this.repository.revokeToken(tokenId);
    await this.auditService.record({
      action: 'service_account.token_revoked',
      resource: 'service_account',
      resourceId: id,
      metadata: { tokenId },
    });
  }
}
