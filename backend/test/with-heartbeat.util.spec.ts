import { withSequenceAndHeartbeat } from '../src/modules/ai/streaming/with-heartbeat';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function* sourceOf(
  values: Array<{ value: string; delayMs?: number }>,
): AsyncGenerator<string> {
  for (const item of values) {
    if (item.delayMs) {
      await delay(item.delayMs);
    }
    yield item.value;
  }
}

async function collect<T>(iterable: AsyncIterable<T>, limit: number): Promise<T[]> {
  const results: T[] = [];
  for await (const item of iterable) {
    results.push(item);
    if (results.length >= limit) {
      break;
    }
  }
  return results;
}

describe('withSequenceAndHeartbeat', () => {
  it('assigns strictly increasing sequence numbers to real events with no heartbeats when the source is fast', async () => {
    const events = await collect(
      withSequenceAndHeartbeat(sourceOf([{ value: 'a' }, { value: 'b' }, { value: 'c' }]), 10_000),
      3,
    );

    expect(events.map((item) => item.event)).toEqual(['a', 'b', 'c']);
    expect(events.map((item) => item.sequence)).toEqual([0, 1, 2]);
  });

  it('emits heartbeats while the source is quiet, without losing or reordering the eventual real event', async () => {
    const events: Array<{ sequence: number; event: unknown }> = [];
    for await (const item of withSequenceAndHeartbeat(
      sourceOf([{ value: 'slow', delayMs: 60 }]),
      15,
    )) {
      events.push(item);
      if (item.event === 'slow') {
        break;
      }
    }

    const heartbeatCount = events.filter(
      (item) =>
        typeof item.event === 'object' && (item.event as { type?: string }).type === 'heartbeat',
    ).length;

    expect(heartbeatCount).toBeGreaterThan(0);
    expect(events[events.length - 1]?.event).toBe('slow');

    const sequences = events.map((item) => item.sequence);
    expect(sequences).toEqual([...sequences].sort((a, b) => a - b));
    expect(new Set(sequences).size).toBe(sequences.length);
  });

  it('propagates a source failure instead of swallowing it', async () => {
    async function* failingSource(): AsyncGenerator<string> {
      yield 'first';
      await Promise.resolve();
      throw new Error('source failed');
    }

    const iterable = withSequenceAndHeartbeat(failingSource(), 10_000);
    const seen: unknown[] = [];

    await expect(
      (async () => {
        for await (const item of iterable) {
          seen.push(item.event);
        }
      })(),
    ).rejects.toThrow('source failed');

    expect(seen).toEqual(['first']);
  });

  it('ends cleanly when the source completes', async () => {
    const events = await collect(
      withSequenceAndHeartbeat(sourceOf([{ value: 'only' }]), 10_000),
      10,
    );
    expect(events).toHaveLength(1);
    expect(events[0]?.event).toBe('only');
  });
});
