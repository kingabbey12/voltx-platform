import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import {
  PromptEntity,
  PromptStatus,
  PromptTestRunEntity,
  PromptVersionEntity,
  toPromptEntity,
  toPromptVersionEntity,
} from './entities/prompt.entity';

export interface CreatePromptData {
  key: string;
  name: string;
  description: string | null;
  category: string | null;
  tags: string[];
  createdByUserId: string | null;
}

export interface UpdatePromptData {
  name?: string;
  description?: string | null;
  category?: string | null;
  tags?: string[];
  status?: PromptStatus;
  publishedVersionId?: string | null;
  archivedAt?: Date | null;
  updatedByUserId?: string | null;
}

export interface CreateVersionData {
  template: string;
  variables: string[];
  model: string | null;
  provider: string | null;
  notes: string | null;
  createdByUserId: string | null;
}

export interface ListPromptsParams {
  status?: PromptStatus;
  category?: string;
  page: number;
  limit: number;
}

export interface CreateTestRunData {
  promptId: string;
  promptVersionId: string | null;
  renderedPrompt: string;
  variables: Record<string, string>;
  model: string | null;
  provider: string | null;
  latencyMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  costUsd: number | null;
  response: string | null;
  createdByUserId: string | null;
}

/**
 * Tenant-scoped persistence for prompts, their immutable versions, and test
 * runs. Every read and write is filtered by the current organizationId.
 */
@Injectable()
export class PromptsRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  private get prompts() {
    return this.prisma.system.prompt;
  }
  private get versions() {
    return this.prisma.system.promptVersion;
  }
  private get testRuns() {
    return this.prisma.system.promptTestRun;
  }

  async createPrompt(data: CreatePromptData): Promise<PromptEntity> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.prompts.create({
      data: {
        organizationId: tenant.organizationId,
        key: data.key,
        name: data.name,
        description: data.description,
        category: data.category,
        tags: data.tags,
        createdByUserId: data.createdByUserId,
        updatedByUserId: data.createdByUserId,
      },
    });
    return toPromptEntity(record);
  }

  async findPromptById(id: string): Promise<PromptEntity | null> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.prompts.findFirst({
      where: { id, organizationId: tenant.organizationId, deletedAt: null },
    });
    return record ? toPromptEntity(record) : null;
  }

  async keyExists(key: string): Promise<boolean> {
    const tenant = this.tenantContextService.getOrThrow();
    const count = await this.prompts.count({
      where: { organizationId: tenant.organizationId, key, deletedAt: null },
    });
    return count > 0;
  }

  async listPrompts(params: ListPromptsParams): Promise<{ items: PromptEntity[]; total: number }> {
    const tenant = this.tenantContextService.getOrThrow();
    const where: Prisma.PromptWhereInput = {
      organizationId: tenant.organizationId,
      deletedAt: null,
      ...(params.status ? { status: params.status } : {}),
      ...(params.category ? { category: params.category } : {}),
    };
    const [records, total] = await Promise.all([
      this.prompts.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
      }),
      this.prompts.count({ where }),
    ]);
    return { items: records.map(toPromptEntity), total };
  }

  async updatePrompt(id: string, data: UpdatePromptData): Promise<PromptEntity> {
    const record = await this.prompts.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.category !== undefined ? { category: data.category } : {}),
        ...(data.tags !== undefined ? { tags: data.tags } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.publishedVersionId !== undefined
          ? { publishedVersionId: data.publishedVersionId }
          : {}),
        ...(data.archivedAt !== undefined ? { archivedAt: data.archivedAt } : {}),
        ...(data.updatedByUserId !== undefined ? { updatedByUserId: data.updatedByUserId } : {}),
      },
    });
    return toPromptEntity(record);
  }

  async softDeletePrompt(id: string): Promise<void> {
    await this.prompts.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async createVersion(promptId: string, data: CreateVersionData): Promise<PromptVersionEntity> {
    const tenant = this.tenantContextService.getOrThrow();
    const latest = await this.findLatestVersion(promptId);
    const record = await this.versions.create({
      data: {
        promptId,
        organizationId: tenant.organizationId,
        version: (latest?.version ?? 0) + 1,
        template: data.template,
        variables: data.variables,
        model: data.model,
        provider: data.provider,
        notes: data.notes,
        createdByUserId: data.createdByUserId,
      },
    });
    return toPromptVersionEntity(record);
  }

  async listVersions(promptId: string): Promise<PromptVersionEntity[]> {
    const tenant = this.tenantContextService.getOrThrow();
    const records = await this.versions.findMany({
      where: { promptId, organizationId: tenant.organizationId },
      orderBy: { version: 'desc' },
    });
    return records.map(toPromptVersionEntity);
  }

  async findLatestVersion(promptId: string): Promise<PromptVersionEntity | null> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.versions.findFirst({
      where: { promptId, organizationId: tenant.organizationId },
      orderBy: { version: 'desc' },
    });
    return record ? toPromptVersionEntity(record) : null;
  }

  async findVersionById(promptId: string, versionId: string): Promise<PromptVersionEntity | null> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.versions.findFirst({
      where: { id: versionId, promptId, organizationId: tenant.organizationId },
    });
    return record ? toPromptVersionEntity(record) : null;
  }

  /**
   * Resolves the published version of a prompt by key for one org — the AI
   * Gateway's read path. Organization is passed explicitly so it works from
   * any runtime context.
   */
  async findPublishedByKey(
    organizationId: string,
    key: string,
  ): Promise<{ prompt: PromptEntity; version: PromptVersionEntity } | null> {
    const prompt = await this.prompts.findFirst({
      where: {
        organizationId,
        key,
        status: 'PUBLISHED',
        deletedAt: null,
        publishedVersionId: { not: null },
      },
    });
    if (!prompt || !prompt.publishedVersionId) {
      return null;
    }
    const version = await this.versions.findFirst({
      where: { id: prompt.publishedVersionId, organizationId },
    });
    if (!version) {
      return null;
    }
    return { prompt: toPromptEntity(prompt), version: toPromptVersionEntity(version) };
  }

  async createTestRun(data: CreateTestRunData): Promise<PromptTestRunEntity> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.testRuns.create({
      data: {
        promptId: data.promptId,
        promptVersionId: data.promptVersionId,
        organizationId: tenant.organizationId,
        renderedPrompt: data.renderedPrompt,
        variables: data.variables,
        model: data.model,
        provider: data.provider,
        latencyMs: data.latencyMs,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        totalTokens: data.totalTokens,
        costUsd: data.costUsd,
        response: data.response,
        createdByUserId: data.createdByUserId,
      },
    });
    return {
      id: record.id,
      promptId: record.promptId,
      promptVersionId: record.promptVersionId,
      organizationId: record.organizationId,
      renderedPrompt: record.renderedPrompt,
      variables: data.variables,
      model: record.model,
      provider: record.provider,
      latencyMs: record.latencyMs,
      inputTokens: record.inputTokens,
      outputTokens: record.outputTokens,
      totalTokens: record.totalTokens,
      costUsd: record.costUsd ? Number(record.costUsd) : null,
      response: record.response,
      createdByUserId: record.createdByUserId,
      createdAt: record.createdAt,
    };
  }
}
