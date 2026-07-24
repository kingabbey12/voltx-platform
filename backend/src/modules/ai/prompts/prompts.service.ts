import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { AIGatewayService } from '../gateway/ai-gateway.service';
import { AiGatewayChatInput } from '../gateway/ai-gateway.types';
import { calculateEstimatedCostUsd } from '../gateway/ai-pricing.config';
import { AIProviderName, AIUsage } from '../models/ai-model.types';
import {
  CreatePromptDto,
  ListPromptsQueryDto,
  PaginatedPromptsDto,
  PromptResponseDto,
  PromptTestResultDto,
  PromptVersionResponseDto,
  PublishPromptDto,
  RollbackPromptDto,
  TestPromptDto,
  UpdatePromptDto,
} from './dto/prompt.dto';
import { PromptEntity, PromptStatus, PromptVersionEntity } from './entities/prompt.entity';
import { PromptRendererService } from './prompt-renderer.service';
import { PromptResolverService } from './prompt-resolver.service';
import { PromptsRepository, UpdatePromptData } from './prompts.repository';

const RESOURCE = 'ai_prompt';

/**
 * Status moves allowed through PATCH (the review workflow). PUBLISHED and
 * ARCHIVED are reached only via their dedicated endpoints, keeping the linear
 * lifecycle DRAFT → REVIEW → APPROVED → PUBLISHED → ARCHIVED enforced.
 */
const REVIEW_TRANSITIONS: Record<PromptStatus, PromptStatus[]> = {
  DRAFT: ['REVIEW'],
  REVIEW: ['APPROVED', 'DRAFT'],
  APPROVED: ['DRAFT', 'REVIEW'],
  PUBLISHED: [],
  ARCHIVED: [],
};

/**
 * Management business logic for prompts: lifecycle transitions, immutable
 * versioning, rollback (restores any prior version as a new version, never
 * mutating history), and test execution through the existing AI Gateway. Every
 * mutation is tenant-scoped (via the repository) and audited.
 */
@Injectable()
export class PromptsService {
  constructor(
    private readonly repository: PromptsRepository,
    private readonly renderer: PromptRendererService,
    private readonly resolver: PromptResolverService,
    private readonly gateway: AIGatewayService,
    private readonly auditService: AuditService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  async create(dto: CreatePromptDto): Promise<PromptResponseDto> {
    const tenant = this.tenantContextService.getOrThrow();
    const key = dto.key.trim();

    if (await this.repository.keyExists(key)) {
      throw new ConflictException(`A prompt with key "${key}" already exists.`);
    }

    const variables = dto.variables ?? [];
    this.validateTemplate(dto.template, variables);

    const prompt = await this.repository.createPrompt({
      key,
      name: dto.name.trim(),
      description: dto.description ?? null,
      category: dto.category ?? null,
      tags: dto.tags ?? [],
      createdByUserId: tenant.userId ?? null,
    });

    const version = await this.repository.createVersion(prompt.id, {
      template: dto.template,
      variables,
      model: dto.model ?? null,
      provider: dto.provider ?? null,
      notes: dto.notes ?? null,
      createdByUserId: tenant.userId ?? null,
    });

    await this.audit('ai.prompt.created', prompt.id, { key, version: version.version });
    return PromptResponseDto.fromEntity(prompt, version);
  }

  async list(query: ListPromptsQueryDto): Promise<PaginatedPromptsDto> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { items, total } = await this.repository.listPrompts({
      status: query.status,
      category: query.category,
      page,
      limit,
    });
    return {
      items: items.map((prompt) => PromptResponseDto.fromEntity(prompt, null)),
      total,
      page,
      limit,
    };
  }

  async get(id: string): Promise<PromptResponseDto> {
    const prompt = await this.getOrThrow(id);
    const latest = await this.repository.findLatestVersion(id);
    return PromptResponseDto.fromEntity(prompt, latest);
  }

  async history(id: string): Promise<PromptVersionResponseDto[]> {
    await this.getOrThrow(id);
    const versions = await this.repository.listVersions(id);
    return versions.map((version) => PromptVersionResponseDto.fromEntity(version));
  }

  async update(id: string, dto: UpdatePromptDto): Promise<PromptResponseDto> {
    const tenant = this.tenantContextService.getOrThrow();
    const prompt = await this.getOrThrow(id);
    if (prompt.status === 'ARCHIVED') {
      throw new ConflictException('Archived prompts cannot be modified.');
    }

    // A template/variables/model/provider change appends a new immutable
    // version — existing versions are never mutated.
    const wantsNewVersion =
      dto.template !== undefined ||
      dto.variables !== undefined ||
      dto.model !== undefined ||
      dto.provider !== undefined;

    let newVersion: PromptVersionEntity | null = null;
    if (wantsNewVersion) {
      const latest = await this.repository.findLatestVersion(id);
      const template = dto.template ?? latest?.template;
      if (!template) {
        throw new BadRequestException('A template is required to create a new version.');
      }
      const variables = dto.variables ?? latest?.variables ?? [];
      this.validateTemplate(template, variables);
      newVersion = await this.repository.createVersion(id, {
        template,
        variables,
        model: dto.model ?? latest?.model ?? null,
        provider: dto.provider ?? latest?.provider ?? null,
        notes: dto.notes ?? null,
        createdByUserId: tenant.userId ?? null,
      });
    }

    const update: UpdatePromptData = { updatedByUserId: tenant.userId ?? null };
    if (dto.name !== undefined) update.name = dto.name.trim();
    if (dto.description !== undefined) update.description = dto.description ?? null;
    if (dto.category !== undefined) update.category = dto.category ?? null;
    if (dto.tags !== undefined) update.tags = dto.tags;
    if (dto.status !== undefined && dto.status !== prompt.status) {
      this.assertReviewTransition(prompt.status, dto.status);
      update.status = dto.status;
    }

    const updated = await this.repository.updatePrompt(id, update);
    await this.audit('ai.prompt.updated', id, {
      fields: Object.keys(dto),
      newVersion: newVersion?.version,
    });

    const latestVersion = newVersion ?? (await this.repository.findLatestVersion(id));
    return PromptResponseDto.fromEntity(updated, latestVersion);
  }

  async publish(id: string, dto: PublishPromptDto): Promise<PromptResponseDto> {
    const tenant = this.tenantContextService.getOrThrow();
    const prompt = await this.getOrThrow(id);
    if (prompt.status === 'ARCHIVED') {
      throw new ConflictException('Archived prompts cannot be published.');
    }
    if (prompt.status !== 'APPROVED' && prompt.status !== 'PUBLISHED') {
      throw new ConflictException('A prompt must be APPROVED before it can be published.');
    }

    const version = dto.versionId
      ? await this.repository.findVersionById(id, dto.versionId)
      : await this.repository.findLatestVersion(id);
    if (!version) {
      throw new NotFoundException(
        dto.versionId ? 'Version not found' : 'Prompt has no versions to publish',
      );
    }

    const updated = await this.repository.updatePrompt(id, {
      status: 'PUBLISHED',
      publishedVersionId: version.id,
      updatedByUserId: tenant.userId ?? null,
    });
    await this.audit('ai.prompt.published', id, { key: prompt.key, version: version.version });
    return PromptResponseDto.fromEntity(updated, await this.repository.findLatestVersion(id));
  }

  async archive(id: string): Promise<PromptResponseDto> {
    const tenant = this.tenantContextService.getOrThrow();
    const prompt = await this.getOrThrow(id);
    if (prompt.status === 'ARCHIVED') {
      throw new ConflictException('Prompt is already archived.');
    }

    const updated = await this.repository.updatePrompt(id, {
      status: 'ARCHIVED',
      archivedAt: new Date(),
      updatedByUserId: tenant.userId ?? null,
    });
    await this.audit('ai.prompt.archived', id, { key: prompt.key });
    return PromptResponseDto.fromEntity(updated, await this.repository.findLatestVersion(id));
  }

  async rollback(id: string, dto: RollbackPromptDto): Promise<PromptResponseDto> {
    const tenant = this.tenantContextService.getOrThrow();
    const prompt = await this.getOrThrow(id);
    if (prompt.status === 'ARCHIVED') {
      throw new ConflictException('Archived prompts cannot be rolled back.');
    }

    const target = await this.repository.findVersionById(id, dto.versionId);
    if (!target) {
      throw new NotFoundException('Version not found');
    }

    // Restore by appending a new immutable version copied from the target —
    // history is preserved intact.
    const newVersion = await this.repository.createVersion(id, {
      template: target.template,
      variables: target.variables,
      model: target.model,
      provider: target.provider,
      notes: `Rollback to v${target.version}`,
      createdByUserId: tenant.userId ?? null,
    });

    const update: UpdatePromptData = { updatedByUserId: tenant.userId ?? null };
    // If the prompt is live, keep it live on the restored content.
    if (prompt.status === 'PUBLISHED') {
      update.publishedVersionId = newVersion.id;
    }
    const updated = await this.repository.updatePrompt(id, update);

    await this.audit('ai.prompt.rolled_back', id, {
      key: prompt.key,
      fromVersion: target.version,
      newVersion: newVersion.version,
    });
    return PromptResponseDto.fromEntity(updated, newVersion);
  }

  async delete(id: string): Promise<void> {
    const prompt = await this.getOrThrow(id);
    await this.repository.softDeletePrompt(id);
    await this.audit('ai.prompt.deleted', id, { key: prompt.key });
  }

  /**
   * Renders a version with the supplied sample variables and runs it through
   * the existing AI Gateway (no conversationId, so nothing is persisted as a
   * production conversation), returning the rendered prompt and the run's
   * latency, token usage, and estimated cost alongside the model response.
   */
  async test(id: string, dto: TestPromptDto): Promise<PromptTestResultDto> {
    const tenant = this.tenantContextService.getOrThrow();
    const prompt = await this.getOrThrow(id);
    const version = await this.resolveTestVersion(id, prompt, dto.versionId);

    const rendered = await this.resolver.renderTemplate(
      { organizationId: tenant.organizationId, userId: tenant.userId },
      version.template,
      dto.variables ?? {},
    );

    const provider = (dto.provider ?? version.provider ?? undefined) as AIProviderName | undefined;
    const requestedModel = dto.model ?? version.model ?? undefined;
    const sampleInput = dto.input?.trim();

    const input: AiGatewayChatInput = {
      requestType: 'CHAT',
      provider,
      model: requestedModel,
      // With a sample user turn the rendered prompt acts as the system prompt;
      // without one, the rendered prompt is the user turn being executed.
      systemPrompt: sampleInput ? rendered : undefined,
      userPrompt: sampleInput || rendered,
      temperature: dto.temperature,
      maxOutputTokens: dto.maxOutputTokens,
    };

    const startedAt = Date.now();
    let response = '';
    let finishReason: string | null = null;
    let usage: AIUsage | undefined;
    let resolvedProvider: AIProviderName | undefined = provider;
    let resolvedModel: string | undefined = requestedModel;
    let errorMessage: string | undefined;

    for await (const event of this.gateway.streamChat(input)) {
      resolvedProvider = event.provider;
      resolvedModel = event.model;
      if (event.type === 'content_delta') {
        response += event.delta;
      } else if (event.type === 'message_end') {
        finishReason = event.finishReason ?? null;
        usage = event.usage;
        if (event.outputText && event.outputText.trim().length > 0) {
          response = event.outputText;
        }
      } else if (event.type === 'error') {
        errorMessage = event.message;
      }
    }

    const latencyMs = Date.now() - startedAt;
    if (errorMessage) {
      throw new BadRequestException(`Prompt test failed: ${errorMessage}`);
    }

    const inputTokens = usage?.inputTokens ?? 0;
    const outputTokens = usage?.outputTokens ?? 0;
    const totalTokens = usage?.totalTokens ?? inputTokens + outputTokens;
    const costUsd = calculateEstimatedCostUsd(resolvedModel, inputTokens, outputTokens);

    const testRun = await this.repository.createTestRun({
      promptId: id,
      promptVersionId: version.id,
      renderedPrompt: rendered,
      variables: dto.variables ?? {},
      model: resolvedModel ?? null,
      provider: resolvedProvider ?? null,
      latencyMs,
      inputTokens,
      outputTokens,
      totalTokens,
      costUsd,
      response,
      createdByUserId: tenant.userId ?? null,
    });

    await this.audit('ai.prompt.tested', id, {
      key: prompt.key,
      version: version.version,
      provider: resolvedProvider,
      model: resolvedModel,
      latencyMs,
      totalTokens,
    });

    const result = PromptTestResultDto.fromEntity(testRun, response);
    result.finishReason = finishReason;
    return result;
  }

  private async resolveTestVersion(
    id: string,
    prompt: PromptEntity,
    versionId?: string,
  ): Promise<PromptVersionEntity> {
    if (versionId) {
      const version = await this.repository.findVersionById(id, versionId);
      if (!version) {
        throw new NotFoundException('Version not found');
      }
      return version;
    }
    if (prompt.publishedVersionId) {
      const published = await this.repository.findVersionById(id, prompt.publishedVersionId);
      if (published) {
        return published;
      }
    }
    const latest = await this.repository.findLatestVersion(id);
    if (!latest) {
      throw new ConflictException('Prompt has no versions to test.');
    }
    return latest;
  }

  private validateTemplate(template: string, variables: string[]): void {
    const result = this.renderer.validate(template, variables);
    if (!result.valid) {
      throw new BadRequestException({
        message: 'Invalid prompt template',
        errors: result.errors,
      });
    }
  }

  private assertReviewTransition(from: PromptStatus, to: PromptStatus): void {
    const allowed = REVIEW_TRANSITIONS[from] ?? [];
    if (!allowed.includes(to)) {
      throw new ConflictException(`Cannot change status from ${from} to ${to}.`);
    }
  }

  private async getOrThrow(id: string): Promise<PromptEntity> {
    const prompt = await this.repository.findPromptById(id);
    if (!prompt) {
      throw new NotFoundException('Prompt not found');
    }
    return prompt;
  }

  private async audit(
    action: string,
    resourceId: string | undefined,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.auditService.record({ action, resource: RESOURCE, resourceId, metadata });
  }
}
