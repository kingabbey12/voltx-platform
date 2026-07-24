import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';
import { AgentRepository } from './agent.repository';
import { AgentToolRepository } from './agent-tool.repository';
import { AgentVersionRepository } from './agent-version.repository';
import {
  AgentVersionResponseDto,
  CreateAgentVersionDto,
  PublishAgentVersionDto,
  RollbackAgentVersionDto,
} from './dto/agent-version.dto';
import { AgentResponseDto } from './dto/agent.dto';
import { AgentEntity } from './entities/agent.entity';

/**
 * Owns Agent version lifecycle: create an immutable snapshot, publish one
 * live, archive, and roll back — mirrors PromptsService's publish/archive/
 * rollback shape, applied to Agent instead of Prompt. Kept as its own
 * service (rather than folded into AgentService) the same way
 * AgentApprovalController injects two focused services instead of one
 * god-service.
 */
@Injectable()
export class AgentVersionService {
  constructor(
    private readonly agentRepository: AgentRepository,
    private readonly agentVersionRepository: AgentVersionRepository,
    private readonly agentToolRepository: AgentToolRepository,
    private readonly auditService: AuditService,
    private readonly tenantContextService: TenantContextService,
  ) {}

  /**
   * Snapshots the agent's current mutable fields (or dto-supplied
   * overrides) into a new immutable version, plus its current live tool
   * allowlist. Does not publish it — a separate call to `publish` is
   * required, same two-step shape as Prompt's create-then-publish.
   */
  async createVersion(
    agentId: string,
    dto: CreateAgentVersionDto,
  ): Promise<AgentVersionResponseDto> {
    const tenant = this.tenantContextService.getOrThrow();
    const agent = await this.getAgentOrThrow(agentId);

    const version = await this.agentVersionRepository.createVersion(agentId, {
      name: dto.name ?? agent.name,
      description: dto.description ?? agent.description,
      systemPrompt: dto.systemPrompt ?? agent.systemPrompt,
      provider: dto.provider ?? agent.provider,
      model: dto.model ?? agent.model,
      temperature: dto.temperature ?? null,
      maxTokens: dto.maxTokens ?? null,
      promptId: dto.promptId ?? null,
      knowledgeCollectionId: dto.knowledgeCollectionId ?? null,
      configuration: dto.configuration ?? agent.configuration,
      createdByUserId: tenant.userId ?? null,
    });

    if (dto.toolNames) {
      await this.agentToolRepository.replaceToolsForAgent(
        agentId,
        dto.toolNames.map((toolName) => ({ toolName })),
      );
    }
    await this.agentToolRepository.snapshotToolsForVersion(agentId, version.id);

    await this.agentRepository.updateAgent(agentId, { latestVersion: version.version });

    await this.auditService.record({
      action: 'create',
      resource: 'ai_agent_version',
      resourceId: version.id,
      metadata: { agentId, version: version.version },
    });

    const toolNames = await this.agentToolRepository.listToolNamesForAgent(agentId, version.id);
    return AgentVersionResponseDto.fromEntity(version, toolNames ?? []);
  }

  async listVersions(agentId: string): Promise<AgentVersionResponseDto[]> {
    await this.getAgentOrThrow(agentId);
    const versions = await this.agentVersionRepository.listByAgent(agentId);
    return Promise.all(
      versions.map(async (version) => {
        const toolNames = await this.agentToolRepository.listToolNamesForAgent(
          agentId,
          version.id,
        );
        return AgentVersionResponseDto.fromEntity(version, toolNames ?? []);
      }),
    );
  }

  /**
   * Publishes a version (defaults to the latest) as the agent's live
   * config. If no version has ever been created for this agent, one is
   * snapshotted first from its current mutable fields so "publish" always
   * works even for an agent that has never called createVersion.
   */
  async publish(agentId: string, dto: PublishAgentVersionDto): Promise<AgentResponseDto> {
    const agent = await this.getAgentOrThrow(agentId);
    if (agent.status === 'ARCHIVED') {
      throw new ConflictException('Archived agents cannot be published.');
    }

    const version = dto.versionId
      ? await this.agentVersionRepository.findById(agentId, dto.versionId)
      : ((await this.agentVersionRepository.findLatest(agentId)) ??
        (await this.createLiveSnapshot(agentId)));

    if (!version) {
      throw new NotFoundException('Version not found');
    }

    const updated = await this.agentRepository.updateAgent(agentId, {
      status: 'PUBLISHED',
      publishedVersionId: version.id,
    });
    if (!updated) {
      throw new NotFoundException(`Agent with id "${agentId}" not found`);
    }

    await this.auditService.record({
      action: 'publish',
      resource: 'ai_agent',
      resourceId: agentId,
      metadata: { versionId: version.id, version: version.version },
    });

    return AgentResponseDto.fromEntity(updated);
  }

  async archive(agentId: string): Promise<AgentResponseDto> {
    const agent = await this.getAgentOrThrow(agentId);
    if (agent.status === 'ARCHIVED') {
      throw new ConflictException('Agent is already archived.');
    }

    const updated = await this.agentRepository.updateAgent(agentId, { status: 'ARCHIVED' });
    if (!updated) {
      throw new NotFoundException(`Agent with id "${agentId}" not found`);
    }

    await this.auditService.record({
      action: 'archive',
      resource: 'ai_agent',
      resourceId: agentId,
      metadata: { name: agent.name },
    });

    return AgentResponseDto.fromEntity(updated);
  }

  /**
   * Repoints publishedVersionId directly at an older version — deliberately
   * simpler than Prompt's rollback-by-copy, since an AgentVersion is just a
   * config snapshot (no template-rendering history to preserve by
   * re-appending). No new version row is created.
   */
  async rollback(agentId: string, dto: RollbackAgentVersionDto): Promise<AgentResponseDto> {
    const agent = await this.getAgentOrThrow(agentId);
    if (agent.status === 'ARCHIVED') {
      throw new ConflictException('Archived agents cannot be rolled back.');
    }

    const target = await this.agentVersionRepository.findById(agentId, dto.versionId);
    if (!target) {
      throw new NotFoundException('Version not found');
    }

    const updated = await this.agentRepository.updateAgent(agentId, {
      status: 'PUBLISHED',
      publishedVersionId: target.id,
    });
    if (!updated) {
      throw new NotFoundException(`Agent with id "${agentId}" not found`);
    }

    await this.auditService.record({
      action: 'rollback',
      resource: 'ai_agent',
      resourceId: agentId,
      metadata: { versionId: target.id, version: target.version },
    });

    return AgentResponseDto.fromEntity(updated);
  }

  private async createLiveSnapshot(agentId: string) {
    const agent = await this.getAgentOrThrow(agentId);
    const tenant = this.tenantContextService.getOrThrow();
    const version = await this.agentVersionRepository.createVersion(agentId, {
      name: agent.name,
      description: agent.description,
      systemPrompt: agent.systemPrompt,
      provider: agent.provider,
      model: agent.model,
      temperature: null,
      maxTokens: null,
      promptId: null,
      knowledgeCollectionId: null,
      configuration: agent.configuration,
      createdByUserId: tenant.userId ?? null,
    });
    await this.agentToolRepository.snapshotToolsForVersion(agentId, version.id);
    await this.agentRepository.updateAgent(agentId, { latestVersion: version.version });
    return version;
  }

  private async getAgentOrThrow(id: string): Promise<AgentEntity> {
    const agent = await this.agentRepository.findAgentById(id);
    if (!agent) {
      throw new NotFoundException(`Agent with id "${id}" not found`);
    }
    return agent;
  }
}
