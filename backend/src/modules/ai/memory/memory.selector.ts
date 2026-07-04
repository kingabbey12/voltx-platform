import { Injectable } from '@nestjs/common';
import { AIMessage } from '../models/ai-model.types';
import { MemoryRepository } from './memory.repository';
import { MemoryScoreBreakdown, MemoryScorer } from './memory.scorer';
import { MemoryEntity } from './entities/memory.entity';

export interface SelectRelevantMemoriesInput {
  conversationId: string;
  userPrompt: string;
  workspaceContext?: string[];
  conversationHistory?: AIMessage[];
  limit?: number;
}

export interface SelectedMemory {
  memory: MemoryEntity;
  score: MemoryScoreBreakdown;
}

const DEFAULT_MEMORY_LIMIT = 5;
const DEFAULT_CANDIDATE_LIMIT = 50;

@Injectable()
export class MemorySelector {
  constructor(
    private readonly memoryRepository: MemoryRepository,
    private readonly memoryScorer: MemoryScorer,
  ) {}

  async select(input: SelectRelevantMemoriesInput): Promise<SelectedMemory[]> {
    const candidates = await this.memoryRepository.listSelectionCandidates(DEFAULT_CANDIDATE_LIMIT);
    if (candidates.length === 0) {
      return [];
    }

    const accesses = await this.memoryRepository.listAccessesForMemories(
      candidates.map((candidate) => candidate.id),
    );
    const lastAccessMap = new Map<string, Date>();
    for (const access of accesses) {
      if (!lastAccessMap.has(access.memoryId)) {
        lastAccessMap.set(access.memoryId, access.accessedAt);
      }
    }

    const query = buildQueryText(input);
    const scored = await Promise.all(
      candidates.map(async (memory) => ({
        memory,
        score: await this.memoryScorer.score({
          query,
          memory,
          lastAccessedAt: lastAccessMap.get(memory.id) ?? null,
        }),
      })),
    );

    const selected = scored
      .filter((item) => item.score.total >= 0.2)
      .sort((left, right) => right.score.total - left.score.total)
      .slice(0, input.limit ?? DEFAULT_MEMORY_LIMIT);

    if (selected.length > 0) {
      await this.memoryRepository.recordMemoryAccesses(
        selected.map((item) => item.memory.id),
        input.conversationId,
      );
    }

    return selected;
  }
}

function buildQueryText(input: SelectRelevantMemoriesInput): string {
  const parts = [
    input.userPrompt.trim(),
    ...(input.workspaceContext ?? []).map((item) => item.trim()),
    ...(input.conversationHistory ?? []).slice(-5).map((message) => message.content.trim()),
  ].filter((item) => item.length > 0);

  return parts.join('\n');
}
