import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { EncryptionService } from '../../integrations/security/encryption.service';
import { AiCredentialTester } from './ai-credential-tester.service';
import {
  AiCredentialResponseDto,
  AiCredentialTestResultDto,
  CreateAiCredentialDto,
  ListAiCredentialsQueryDto,
  PaginatedAiCredentialsDto,
  RotateAiCredentialDto,
  UpdateAiCredentialDto,
} from './dto/ai-credential.dto';
import { AiProviderCredentialEntity } from './entities/ai-provider-credential.entity';
import { TenantAiCredentialsRepository } from './tenant-ai-credentials.repository';

const RESOURCE = 'ai_provider_credential';

/**
 * Business logic for tenant AI credentials: encrypt on write, mask on read,
 * re-encrypt on rotate, health-check via the real provider adapter, and audit
 * every mutation. Plaintext keys exist only transiently inside encrypt/test
 * and are never returned to the client or written to logs.
 */
@Injectable()
export class TenantAiCredentialsService {
  constructor(
    private readonly repository: TenantAiCredentialsRepository,
    private readonly encryptionService: EncryptionService,
    private readonly tester: AiCredentialTester,
    private readonly auditService: AuditService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async create(dto: CreateAiCredentialDto): Promise<AiCredentialResponseDto> {
    const tenant = this.tenantContextService.getOrThrow();
    const label = dto.label?.trim() || 'default';

    if (await this.repository.existsForProviderLabel(dto.provider, label)) {
      throw new ConflictException(
        `A "${dto.provider}" credential labelled "${label}" already exists.`,
      );
    }

    const entity = await this.repository.create({
      provider: dto.provider,
      label,
      encryptedApiKey: this.encryptionService.encrypt(dto.apiKey),
      baseUrl: dto.baseUrl?.trim() || null,
      metadata: dto.metadata ?? {},
      createdByUserId: tenant.userId,
    });

    await this.audit('ai.credential.created', entity.id, { provider: dto.provider, label });
    return this.toResponse(entity);
  }

  async list(query: ListAiCredentialsQueryDto): Promise<PaginatedAiCredentialsDto> {
    const result = await this.repository.list({
      provider: query.provider,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
    return {
      items: result.items.map((entity) => this.toResponse(entity)),
      total: result.total,
      page: result.page,
      limit: result.limit,
    };
  }

  async get(id: string): Promise<AiCredentialResponseDto> {
    return this.toResponse(await this.getOrThrow(id));
  }

  async update(id: string, dto: UpdateAiCredentialDto): Promise<AiCredentialResponseDto> {
    await this.getOrThrow(id);
    const updated = await this.repository.update(id, {
      ...(dto.label !== undefined ? { label: dto.label.trim() || 'default' } : {}),
      ...(dto.baseUrl !== undefined ? { baseUrl: dto.baseUrl.trim() || null } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
      ...(dto.metadata !== undefined ? { metadata: dto.metadata } : {}),
    });
    if (!updated) {
      throw new NotFoundException('AI credential not found');
    }
    await this.audit('ai.credential.updated', id, {
      fields: Object.keys(dto),
    });
    return this.toResponse(updated);
  }

  async rotate(id: string, dto: RotateAiCredentialDto): Promise<AiCredentialResponseDto> {
    await this.getOrThrow(id);
    const updated = await this.repository.update(id, {
      encryptedApiKey: this.encryptionService.encrypt(dto.apiKey),
      lastRotatedAt: new Date(),
      // A rotated key invalidates the previous health-check result.
      lastTestStatus: null,
      lastTestError: null,
    });
    if (!updated) {
      throw new NotFoundException('AI credential not found');
    }
    await this.audit('ai.credential.rotated', id, { provider: updated.provider });
    return this.toResponse(updated);
  }

  async delete(id: string): Promise<void> {
    const existing = await this.getOrThrow(id);
    await this.repository.softDelete(id);
    await this.audit('ai.credential.deleted', id, { provider: existing.provider });
  }

  async test(id: string): Promise<AiCredentialTestResultDto> {
    const entity = await this.getOrThrow(id);
    const result = await this.runTest(entity);
    await this.audit('ai.credential.tested', id, {
      provider: entity.provider,
      result: result.status,
    });
    return result;
  }

  /** Health-check every credential in the org, recording each result. */
  async healthCheckAll(): Promise<AiCredentialTestResultDto[]> {
    const tenant = this.tenantContextService.getOrThrow();
    const credentials = await this.repository.listAllActive(tenant.organizationId);
    const results: AiCredentialTestResultDto[] = [];
    for (const entity of credentials) {
      results.push(await this.runTest(entity));
    }
    await this.audit('ai.credential.health_checked', undefined, { count: credentials.length });
    return results;
  }

  private async runTest(entity: AiProviderCredentialEntity): Promise<AiCredentialTestResultDto> {
    const apiKey = this.encryptionService.decrypt(entity.encryptedApiKey);
    const outcome = await this.tester.test(entity.provider, apiKey, entity.baseUrl ?? undefined);
    const testedAt = new Date();
    await this.repository.update(entity.id, {
      lastTestedAt: testedAt,
      lastTestStatus: outcome.ok ? 'ok' : 'failed',
      lastTestError: outcome.ok ? null : outcome.message,
    });
    return {
      status: outcome.ok ? 'ok' : 'failed',
      message: outcome.message,
      testedAt: testedAt.toISOString(),
    };
  }

  private async getOrThrow(id: string): Promise<AiProviderCredentialEntity> {
    const entity = await this.repository.findById(id);
    if (!entity) {
      throw new NotFoundException('AI credential not found');
    }
    return entity;
  }

  private toResponse(entity: AiProviderCredentialEntity): AiCredentialResponseDto {
    return AiCredentialResponseDto.fromEntity(entity, this.mask(entity.encryptedApiKey));
  }

  /**
   * Masked preview derived from the decrypted key: keeps a short leading hint
   * and the last 4 characters, e.g. "sk-…4f2a". Short keys are fully redacted.
   */
  private mask(encryptedApiKey: string): string {
    const plaintext = this.encryptionService.decrypt(encryptedApiKey);
    if (plaintext.length <= 8) {
      return '••••';
    }
    const prefix = plaintext.slice(0, plaintext.startsWith('sk-') ? 3 : 2);
    return `${prefix}…${plaintext.slice(-4)}`;
  }

  private async audit(
    action: string,
    resourceId: string | undefined,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.auditService.record({ action, resource: RESOURCE, resourceId, metadata });
  }
}
