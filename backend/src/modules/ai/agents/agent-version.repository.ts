import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { AgentVersionEntity, toAgentVersionEntity } from './entities/agent-version.entity';

export interface CreateAgentVersionData {
  name: string;
  description: string;
  systemPrompt: string;
  provider: string;
  model: string;
  temperature: number | null;
  maxTokens: number | null;
  promptId: string | null;
  knowledgeCollectionId: string | null;
  configuration: Record<string, unknown>;
  createdByUserId: string | null;
}

/**
 * Tenant-scoped persistence for immutable Agent config snapshots — mirrors
 * PromptsRepository's version methods exactly (createVersion computes the
 * next version number from the current max, one row per version, never
 * mutated after creation).
 */
@Injectable()
export class AgentVersionRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  private get versions() {
    return this.prisma.system.agentVersion;
  }

  async createVersion(agentId: string, data: CreateAgentVersionData): Promise<AgentVersionEntity> {
    const tenant = this.tenantContextService.getOrThrow();
    const latest = await this.findLatest(agentId);
    const record = await this.versions.create({
      data: {
        agentId,
        organizationId: tenant.organizationId,
        version: (latest?.version ?? 0) + 1,
        name: data.name,
        description: data.description,
        systemPrompt: data.systemPrompt,
        provider: data.provider,
        model: data.model,
        temperature: data.temperature,
        maxTokens: data.maxTokens,
        promptId: data.promptId,
        knowledgeCollectionId: data.knowledgeCollectionId,
        configuration: data.configuration as Prisma.InputJsonValue,
        createdByUserId: data.createdByUserId,
      },
    });
    return toAgentVersionEntity(record);
  }

  async listByAgent(agentId: string): Promise<AgentVersionEntity[]> {
    const tenant = this.tenantContextService.getOrThrow();
    const records = await this.versions.findMany({
      where: { agentId, organizationId: tenant.organizationId },
      orderBy: { version: 'desc' },
    });
    return records.map(toAgentVersionEntity);
  }

  async findLatest(agentId: string): Promise<AgentVersionEntity | null> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.versions.findFirst({
      where: { agentId, organizationId: tenant.organizationId },
      orderBy: { version: 'desc' },
    });
    return record ? toAgentVersionEntity(record) : null;
  }

  async findById(agentId: string, versionId: string): Promise<AgentVersionEntity | null> {
    const tenant = this.tenantContextService.getOrThrow();
    const record = await this.versions.findFirst({
      where: { id: versionId, agentId, organizationId: tenant.organizationId },
    });
    return record ? toAgentVersionEntity(record) : null;
  }

  /**
   * Bypasses tenant scoping — for the scheduler's background-context
   * resolution, mirroring AgentRepository.findAgentByIdUnscoped.
   */
  async findByIdUnscoped(versionId: string): Promise<AgentVersionEntity | null> {
    const record = await this.versions.findFirst({ where: { id: versionId } });
    return record ? toAgentVersionEntity(record) : null;
  }
}
