import { forwardRef, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { AIGatewayService } from '../gateway/ai-gateway.service';
import { AIMessage } from '../models/ai-model.types';
import { CreateMemoryDto, MemoryResponseDto, PaginatedMemoriesDto } from './dto/memory.dto';
import { MemoryEntity } from './entities/memory.entity';
import { ListMemoriesParams, MemoryRepository, PaginatedMemories } from './memory.repository';
import { MemorySelector } from './memory.selector';
import { TenantContextService } from '../../../common/tenant/tenant-context.service';

const DEFAULT_MEMORY_IMPORTANCE = 0.5;
const AUTOMATIC_MEMORY_THRESHOLD = 0.65;
const MAX_ACTIVE_MEMORIES = 200;

export interface SelectRelevantMemoriesInput {
  conversationId?: string;
  userPrompt: string;
  workspaceContext?: string[];
  conversationHistory?: AIMessage[];
  limit?: number;
}

export interface CaptureConversationMemoriesInput {
  conversationId: string;
  userContent: string;
  assistantContent?: string;
  assistantMetadata?: Record<string, unknown>;
}

@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);

  constructor(
    private readonly memoryRepository: MemoryRepository,
    private readonly memorySelector: MemorySelector,
    private readonly tenantContextService: TenantContextService,
    private readonly auditService: AuditService,
    @Inject(forwardRef(() => AIGatewayService))
    private readonly aiGatewayService: AIGatewayService,
  ) {}

  async listMemories(params: ListMemoriesParams): Promise<PaginatedMemoriesDto> {
    const result = await this.memoryRepository.listMemories(params);
    return toPaginatedMemoriesDto(result);
  }

  async createMemory(dto: CreateMemoryDto): Promise<MemoryResponseDto> {
    await this.assertConversationAccess(dto.conversationId);

    const entity = await this.memoryRepository.createMemory({
      conversationId: dto.conversationId,
      category: normalizeCategory(dto.category),
      importance:
        dto.importance ??
        inferImportance(dto.content, normalizeCategory(dto.category), {
          ...(dto.metadata ?? {}),
          source: 'manual',
        }),
      content: dto.content.trim(),
      embeddingId: dto.embeddingId?.trim(),
      metadata: {
        ...(dto.metadata ?? {}),
        source: 'manual',
      },
    });

    await this.auditService.record({
      action: 'create',
      resource: 'ai_memory',
      resourceId: entity.id,
      metadata: {
        conversationId: entity.conversationId,
        category: entity.category,
        importance: entity.importance,
      },
    });

    await this.embedAndSave(entity.id, entity.content);
    await this.pruneMemories();
    return MemoryResponseDto.fromEntity(entity);
  }

  async deleteMemory(id: string): Promise<MemoryResponseDto> {
    const entity = await this.memoryRepository.softDeleteMemory(id);
    if (!entity) {
      throw new NotFoundException(`Memory with id "${id}" not found`);
    }

    await this.auditService.record({
      action: 'delete',
      resource: 'ai_memory',
      resourceId: entity.id,
      metadata: {
        conversationId: entity.conversationId,
      },
    });

    return MemoryResponseDto.fromEntity(entity);
  }

  async selectRelevantMemoriesForCompletion(
    input: SelectRelevantMemoriesInput,
  ): Promise<MemoryEntity[]> {
    if (!this.tenantContextService.isComplete() || !input.conversationId) {
      return [];
    }

    const exists = await this.memoryRepository.conversationExists(input.conversationId);
    if (!exists) {
      return [];
    }

    const selected = await this.memorySelector.select({
      conversationId: input.conversationId,
      userPrompt: input.userPrompt,
      workspaceContext: input.workspaceContext,
      conversationHistory: input.conversationHistory,
      limit: input.limit,
    });

    if (selected.length > 0) {
      await this.auditService.record({
        action: 'select',
        resource: 'ai_memory',
        metadata: {
          conversationId: input.conversationId,
          memoryIds: selected.map((item) => item.memory.id),
          count: selected.length,
        },
      });
    }

    return selected.map((item) => item.memory);
  }

  async captureConversationMemories(
    input: CaptureConversationMemoriesInput,
  ): Promise<MemoryEntity[]> {
    if (!this.tenantContextService.isComplete()) {
      return [];
    }

    const exists = await this.memoryRepository.conversationExists(input.conversationId);
    if (!exists) {
      return [];
    }

    const created: MemoryEntity[] = [];
    const candidates = [
      {
        content: input.userContent,
        metadata: { source: 'conversation', role: 'user' },
      },
      ...(input.assistantContent
        ? [
            {
              content: input.assistantContent,
              metadata: {
                source: 'conversation',
                role: 'assistant',
                ...(input.assistantMetadata ?? {}),
              },
            },
          ]
        : []),
    ];

    for (const candidate of candidates) {
      const content = candidate.content.trim();
      if (content.length < 12) {
        continue;
      }

      const category = inferCategory(content);
      const importance = inferImportance(content, category, candidate.metadata);
      if (importance < AUTOMATIC_MEMORY_THRESHOLD) {
        continue;
      }

      const memory = await this.memoryRepository.createMemory({
        conversationId: input.conversationId,
        category,
        importance,
        content,
        metadata: candidate.metadata,
      });
      created.push(memory);
      await this.embedAndSave(memory.id, content);

      await this.auditService.record({
        action: 'capture',
        resource: 'ai_memory',
        resourceId: memory.id,
        metadata: {
          conversationId: memory.conversationId,
          category: memory.category,
          importance: memory.importance,
        },
      });
    }

    if (created.length > 0) {
      await this.pruneMemories();
    }

    return created;
  }

  /** Best-effort: a memory is still fully usable (heuristic-scored) without its embedding, so a failure here must never block memory capture. */
  private async embedAndSave(memoryId: string, content: string): Promise<void> {
    try {
      const response = await this.aiGatewayService.embeddings({ input: [content] });
      const vector = response.vectors[0];
      if (vector) {
        await this.memoryRepository.saveEmbedding(memoryId, vector);
      }
    } catch (error) {
      this.logger.warn({ err: error, memoryId }, 'Failed to compute/save memory embedding');
    }
  }

  private async assertConversationAccess(conversationId: string): Promise<void> {
    const exists = await this.memoryRepository.conversationExists(conversationId);
    if (!exists) {
      throw new NotFoundException(`Conversation with id "${conversationId}" not found`);
    }
  }

  private async pruneMemories(): Promise<void> {
    const activeCount = await this.memoryRepository.countActiveMemories();
    if (activeCount <= MAX_ACTIVE_MEMORIES) {
      return;
    }

    const toPrune = await this.memoryRepository.listPrunableMemories(
      activeCount - MAX_ACTIVE_MEMORIES,
    );
    for (const memory of toPrune) {
      const pruned = await this.memoryRepository.softDeleteMemory(memory.id);
      if (!pruned) {
        continue;
      }

      await this.auditService.record({
        action: 'prune',
        resource: 'ai_memory',
        resourceId: pruned.id,
        metadata: {
          conversationId: pruned.conversationId,
          importance: pruned.importance,
        },
      });
    }

    if (toPrune.length > 0) {
      this.logger.log({ count: toPrune.length }, 'Pruned stale AI memories');
    }
  }
}

function toPaginatedMemoriesDto(result: PaginatedMemories): PaginatedMemoriesDto {
  return {
    items: result.items.map((item) => MemoryResponseDto.fromEntity(item)),
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
  };
}

function normalizeCategory(category: string): string {
  return category.trim().toLowerCase().slice(0, 100);
}

function inferCategory(content: string): string {
  const normalized = content.toLowerCase();
  if (/(remember|prefer|preference|always|never|my preferred)/u.test(normalized)) {
    return 'preference';
  }

  if (/(task|todo|follow up|follow-up|action item|deadline|due)/u.test(normalized)) {
    return 'task';
  }

  if (/(summary|recap|overview)/u.test(normalized)) {
    return 'summary';
  }

  if (/(phone|email|address|contact|account|customer|server)/u.test(normalized)) {
    return 'fact';
  }

  return 'general';
}

function inferImportance(
  content: string,
  category: string,
  metadata: Record<string, unknown>,
): number {
  const normalized = content.toLowerCase();
  const categoryBase =
    {
      preference: 0.7,
      task: 0.68,
      fact: 0.62,
      summary: 0.58,
      general: DEFAULT_MEMORY_IMPORTANCE,
    }[category] ?? DEFAULT_MEMORY_IMPORTANCE;

  let score = categoryBase;

  if (/(remember|prefer|preferred|always|never|important|must)/u.test(normalized)) {
    score += 0.18;
  }

  if (content.trim().length >= 60) {
    score += 0.05;
  }

  if (content.trim().length >= 160) {
    score += 0.05;
  }

  if (metadata.source === 'manual') {
    score += 0.1;
  }

  return Math.max(0, Math.min(1, score));
}
