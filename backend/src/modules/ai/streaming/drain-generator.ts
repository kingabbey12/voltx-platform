/**
 * Fully consumes an async generator and returns its final `return` value,
 * discarding whatever it yielded along the way. Lets a single generator
 * implementation back both a streaming (yield-driven) and a non-streaming
 * (single-response) entry point without duplicating orchestration logic.
 */
export async function drainToReturnValue<TYield, TReturn>(
  generator: AsyncGenerator<TYield, TReturn>,
): Promise<TReturn> {
  let result: IteratorResult<TYield, TReturn> = await generator.next();
  while (!result.done) {
    result = await generator.next();
  }
  return result.value;
}

export function isAbortError(error: unknown): boolean {
  if (error instanceof Error) {
    return error.name === 'AbortError';
  }

  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { name?: unknown }).name === 'AbortError'
  );
}
