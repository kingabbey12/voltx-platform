/**
 * Merges multiple async generators into one, yielding each value the
 * instant any source produces it (true live interleaving, not
 * batch-then-concatenate) — the primitive that makes concurrent agent
 * execution visible to a single output stream in real time. Each source's
 * final `return` value is collected into the result array at its own
 * index once that source completes; sources finish independently.
 */
export async function* mergeAsyncGenerators<T, R>(
  sources: Array<AsyncGenerator<T, R>>,
): AsyncGenerator<T, R[]> {
  const results: R[] = new Array<R>(sources.length);
  const pending = new Map<number, Promise<{ index: number; result: IteratorResult<T, R> }>>();

  sources.forEach((source, index) => {
    pending.set(
      index,
      source.next().then((result) => ({ index, result })),
    );
  });

  while (pending.size > 0) {
    const { index, result } = await Promise.race(pending.values());

    if (result.done) {
      results[index] = result.value;
      pending.delete(index);
      continue;
    }

    yield result.value;
    pending.set(
      index,
      sources[index].next().then((r) => ({ index, result: r })),
    );
  }

  return results;
}
