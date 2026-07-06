import { ConfigService } from '@nestjs/config';
import {
  estimateTokenCount,
  TextChunkerService,
} from '../src/modules/knowledge/chunking/text-chunker.service';

function configServiceWithDefaults(): ConfigService {
  return { get: jest.fn((_key: string, defaultValue: unknown) => defaultValue) } as never;
}

describe('TextChunkerService', () => {
  let service: TextChunkerService;

  beforeEach(() => {
    service = new TextChunkerService(configServiceWithDefaults());
  });

  it('returns no chunks for empty text', () => {
    expect(service.chunk('')).toEqual([]);
    expect(service.chunk('   \n  ')).toEqual([]);
  });

  it('returns a single chunk when text is smaller than the chunk size', () => {
    const text = 'The quick brown fox jumps over the lazy dog.';
    const chunks = service.chunk(text, { chunkSizeTokens: 400, chunkOverlapTokens: 60 });

    expect(chunks).toHaveLength(1);
    expect(chunks[0].index).toBe(0);
    expect(chunks[0].content).toBe(text);
    expect(chunks[0].tokenCount).toBeGreaterThan(0);
  });

  it('splits long text into multiple overlapping chunks with sequential indices', () => {
    const words = Array.from({ length: 1000 }, (_, i) => `word${i}`);
    const text = words.join(' ');

    const chunks = service.chunk(text, { chunkSizeTokens: 100, chunkOverlapTokens: 20 });

    expect(chunks.length).toBeGreaterThan(1);
    chunks.forEach((chunk, i) => expect(chunk.index).toBe(i));

    // Overlap: the tail of one chunk should reappear at the head of the next.
    const firstChunkWords = chunks[0].content.split(' ');
    const secondChunkWords = chunks[1].content.split(' ');
    const overlapWord = firstChunkWords[firstChunkWords.length - 1];
    expect(secondChunkWords).toContain(overlapWord);
  });

  it('covers every word exactly once when overlap is zero', () => {
    const words = Array.from({ length: 50 }, (_, i) => `w${i}`);
    const text = words.join(' ');

    const chunks = service.chunk(text, { chunkSizeTokens: 100, chunkOverlapTokens: 0 });
    const reconstructed = chunks.map((chunk) => chunk.content).join(' ');

    expect(reconstructed).toBe(text);
  });

  it('never infinite-loops when overlap is configured larger than the chunk size', () => {
    const words = Array.from({ length: 200 }, (_, i) => `w${i}`);
    const text = words.join(' ');

    const chunks = service.chunk(text, { chunkSizeTokens: 10, chunkOverlapTokens: 1000 });

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.length).toBeLessThan(1000);
  });

  it('estimateTokenCount scales with word count', () => {
    expect(estimateTokenCount('one')).toBeGreaterThanOrEqual(1);
    expect(estimateTokenCount('one two three four')).toBeGreaterThan(estimateTokenCount('one'));
  });
});
