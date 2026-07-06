import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface TextChunk {
  index: number;
  content: string;
  tokenCount: number;
}

export interface ChunkTextOptions {
  chunkSizeTokens?: number;
  chunkOverlapTokens?: number;
}

/** No fast tokenizer is wired in — this is a deliberate, documented approximation. */
const APPROX_TOKENS_PER_WORD = 1.3;

/**
 * Splits extracted text into overlapping, word-boundary-aligned chunks
 * sized by an approximate token count (no tokenizer dependency — 1 word ≈
 * 1.3 tokens for English, a standard rule-of-thumb approximation used when
 * exact tokenization isn't available). Overlap preserves context across a
 * chunk boundary so a fact split mid-sentence is still retrievable from
 * whichever chunk contains the query terms.
 */
@Injectable()
export class TextChunkerService {
  private readonly defaultChunkSizeTokens: number;
  private readonly defaultChunkOverlapTokens: number;

  constructor(configService: ConfigService) {
    this.defaultChunkSizeTokens = configService.get<number>(
      'knowledge.chunking.chunkSizeTokens',
      400,
    );
    this.defaultChunkOverlapTokens = configService.get<number>(
      'knowledge.chunking.chunkOverlapTokens',
      60,
    );
  }

  chunk(text: string, options: ChunkTextOptions = {}): TextChunk[] {
    const chunkSizeTokens = options.chunkSizeTokens ?? this.defaultChunkSizeTokens;
    const chunkOverlapTokens = options.chunkOverlapTokens ?? this.defaultChunkOverlapTokens;

    const words = text
      .replace(/\r\n/g, '\n')
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0);

    if (words.length === 0) {
      return [];
    }

    const wordsPerChunk = Math.max(1, Math.round(chunkSizeTokens / APPROX_TOKENS_PER_WORD));
    const overlapWords = Math.max(0, Math.round(chunkOverlapTokens / APPROX_TOKENS_PER_WORD));
    const step = Math.max(1, wordsPerChunk - overlapWords);

    const chunks: TextChunk[] = [];
    let index = 0;

    for (let start = 0; start < words.length; start += step) {
      const end = Math.min(words.length, start + wordsPerChunk);
      const content = words.slice(start, end).join(' ');
      chunks.push({ index, content, tokenCount: estimateTokenCount(content) });
      index += 1;

      if (end >= words.length) {
        break;
      }
    }

    return chunks;
  }
}

export function estimateTokenCount(text: string): number {
  const wordCount = text.split(/\s+/).filter((word) => word.length > 0).length;
  return Math.max(1, Math.round(wordCount * APPROX_TOKENS_PER_WORD));
}
