import { mergeAsyncGenerators } from '../src/modules/ai/streaming/merge-async-generators';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function* generatorOf(
  values: Array<{ value: string; delayMs?: number }>,
  returnValue: string,
): AsyncGenerator<string, string> {
  for (const item of values) {
    if (item.delayMs) {
      await delay(item.delayMs);
    }
    yield item.value;
  }
  return returnValue;
}

describe('mergeAsyncGenerators', () => {
  it('yields values from a single source in order and returns its result', async () => {
    const seen: string[] = [];
    const gen = mergeAsyncGenerators([generatorOf([{ value: 'a' }, { value: 'b' }], 'done-a')]);

    let step = await gen.next();
    while (!step.done) {
      seen.push(step.value);
      step = await gen.next();
    }

    expect(seen).toEqual(['a', 'b']);
    expect(step.value).toEqual(['done-a']);
  });

  it('interleaves values from multiple sources as they arrive, faster sources finishing first', async () => {
    const seen: string[] = [];
    const gen = mergeAsyncGenerators([
      generatorOf([{ value: 'slow-1', delayMs: 30 }], 'slow-done'),
      generatorOf([{ value: 'fast-1' }, { value: 'fast-2', delayMs: 5 }], 'fast-done'),
    ]);

    let step = await gen.next();
    while (!step.done) {
      seen.push(step.value);
      step = await gen.next();
    }

    expect(seen).toEqual(['fast-1', 'fast-2', 'slow-1']);
    expect(step.value).toEqual(['slow-done', 'fast-done']);
  });

  it('collects each source result at its own index regardless of completion order', async () => {
    const gen = mergeAsyncGenerators([
      generatorOf([{ value: 'x', delayMs: 20 }], 'result-0'),
      generatorOf([{ value: 'y' }], 'result-1'),
    ]);

    let step = await gen.next();
    while (!step.done) {
      step = await gen.next();
    }

    expect(step.value).toEqual(['result-0', 'result-1']);
  });

  it('handles an empty source list', async () => {
    const gen = mergeAsyncGenerators<string, string>([]);
    const step = await gen.next();

    expect(step.done).toBe(true);
    expect(step.value).toEqual([]);
  });

  it('propagates a source failure', async () => {
    async function* failing(): AsyncGenerator<string, string> {
      await Promise.resolve();
      yield 'ok';
      throw new Error('source blew up');
    }

    const gen = mergeAsyncGenerators([failing()]);
    const seen: string[] = [];

    await expect(
      (async () => {
        let step = await gen.next();
        while (!step.done) {
          seen.push(step.value);
          step = await gen.next();
        }
      })(),
    ).rejects.toThrow('source blew up');

    expect(seen).toEqual(['ok']);
  });
});
