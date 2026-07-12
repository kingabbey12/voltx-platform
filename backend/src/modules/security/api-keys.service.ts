import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuditService } from '../audit/audit.service';
import { PermissionRepository } from '../permissions/permission.repository';
import { ApiKeyRecord, ApiKeyRepository } from './api-key.repository';
import { ApiKeyResponseDto, CreateApiKeyDto, CreateApiKeyResponseDto } from './dto/api-key.dto';
import { generateApiKeySecret, sha256Hex } from './utils/security-hash.util';

function toResponseDto(record: ApiKeyRecord): ApiKeyResponseDto {
  return {
    id: record.id,
    name: record.name,
    keyPrefix: record.keyPrefix,
    scopedPermissions: record.scopedPermissions,
    expiresAt: record.expiresAt?.toISOString() ?? null,
    lastUsedAt: record.lastUsedAt?.toISOString() ?? null,
    revokedAt: record.revokedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
  };
}

@Injectable()
export class ApiKeysService {
  constructor(
    private readonly apiKeyRepository: ApiKeyRepository,
    private readonly permissionRepository: PermissionRepository,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    organizationId: string,
    createdByUserId: string,
    callerPermissions: string[],
    dto: CreateApiKeyDto,
  ): Promise<CreateApiKeyResponseDto> {
    await this.assertScopedPermissionsAreValid(dto.scopedPermissions, callerPermissions);

    const prefixConfig = this.configService.get<string>('apiKeys.prefix', 'vk');
    const secret = generateApiKeySecret();
    const rawKey = `${prefixConfig}_${secret}`;
    const keyHash = sha256Hex(rawKey);
    const keyPrefix = `${prefixConfig}_${secret.slice(0, 8)}...`;

    const record = await this.apiKeyRepository.create({
      organizationId,
      createdByUserId,
      name: dto.name,
      keyHash,
      keyPrefix,
      scopedPermissions: dto.scopedPermissions,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
    });

    await this.auditService.record({
      action: 'apikey.created',
      resource: 'api_key',
      resourceId: record.id,
      metadata: { scopedPermissions: dto.scopedPermissions },
    });

    return { ...toResponseDto(record), apiKey: rawKey };
  }

  async list(organizationId: string): Promise<ApiKeyResponseDto[]> {
    const records = await this.apiKeyRepository.listByOrganization(organizationId);
    return records.map(toResponseDto);
  }

  async revoke(id: string, organizationId: string): Promise<void> {
    const record = await this.apiKeyRepository.findByIdInOrganization(id, organizationId);
    if (!record) {
      throw new NotFoundException('API key not found');
    }
    if (record.revokedAt) {
      throw new ForbiddenException('API key already revoked');
    }

    await this.apiKeyRepository.revoke(id);
    await this.auditService.record({
      action: 'apikey.revoked',
      resource: 'api_key',
      resourceId: id,
    });
  }

  /** An API key must never grant more than its creator currently holds —
   * otherwise a low-privileged member could mint a key with owner-level
   * scope. Every requested key must also be a real, known permission. */
  private async assertScopedPermissionsAreValid(
    requested: string[],
    callerPermissions: string[],
  ): Promise<void> {
    const notHeldByCaller = requested.filter((key) => !callerPermissions.includes(key));
    if (notHeldByCaller.length > 0) {
      throw new ForbiddenException(
        `Cannot scope an API key to permissions you don't hold: ${notHeldByCaller.join(', ')}`,
      );
    }

    const allPermissions = await this.permissionRepository.findAll();
    const knownKeys = new Set(allPermissions.map((permission) => permission.key));
    const unknown = requested.filter((key) => !knownKeys.has(key));
    if (unknown.length > 0) {
      throw new BadRequestException(`Unknown permission key(s): ${unknown.join(', ')}`);
    }
  }
}
