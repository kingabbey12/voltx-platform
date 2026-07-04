import { Inject, Injectable } from '@nestjs/common';
import { MemoryEntity } from './entities/memory.entity';

export interface SemanticMemoryScorer {
  score(query: string, memory: MemoryEntity): Promise<number>;
}

export const SEMANTIC_MEMORY_SCORER = Symbol('SEMANTIC_MEMORY_SCORER');

export interface MemoryScoreBreakdown {
  importance: number;
  recency: number;
  lexical: number;
  semantic: number;
  total: number;
}

export interface ScoreMemoryInput {
  query: string;
  memory: MemoryEntity;
  lastAccessedAt?: Date | null;
  now?: Date;
}

@Injectable()
export class NoopSemanticMemoryScorer implements SemanticMemoryScorer {
  score(): Promise<number> {
    return Promise.resolve(0);
  }
}

@Injectable()
export class MemoryScorer {
  constructor(
    @Inject(SEMANTIC_MEMORY_SCORER) private readonly semanticMemoryScorer: SemanticMemoryScorer,
  ) {}

  async score(input: ScoreMemoryInput): Promise<MemoryScoreBreakdown> {
    const now = input.now ?? new Date();
    const importance = clamp(input.memory.importance);
    const recency = scoreRecency(input.memory.updatedAt, input.lastAccessedAt, now);
    const lexical = scoreLexicalOverlap(input.query, input.memory.content);
    const semantic = clamp(await this.semanticMemoryScorer.score(input.query, input.memory));
    const total = clamp(importance * 0.4 + recency * 0.25 + lexical * 0.25 + semantic * 0.1);

    return {
      importance,
      recency,
      lexical,
      semantic,
      total,
    };
  }
}

function scoreRecency(updatedAt: Date, lastAccessedAt: Date | null | undefined, now: Date): number {
  const reference = lastAccessedAt && lastAccessedAt > updatedAt ? lastAccessedAt : updatedAt;
  const ageHours = Math.max(0, (now.getTime() - reference.getTime()) / (1000 * 60 * 60));
  return clamp(Math.exp(-ageHours / (24 * 14)));
}

function scoreLexicalOverlap(query: string, content: string): number {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) {
    return 0;
  }

  const contentTokens = new Set(tokenize(content));
  const overlap = queryTokens.filter((token) => contentTokens.has(token)).length;
  return clamp(overlap / queryTokens.length);
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}
