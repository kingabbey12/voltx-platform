export interface SequencedStreamEvent<T> {
  sequence: number;
  event: T | { type: 'heartbeat' };
}

const HEARTBEAT = Symbol('heartbeat');

/**
 * Wraps a source async iterable so that:
 *  - every emitted event carries a monotonically increasing `sequence`
 *    number (written as the SSE `id:` field so a reconnecting EventSource
 *    client sends `Last-Event-ID` correctly), and
 *  - a synthetic heartbeat event is emitted on a fixed interval whenever the
 *    source goes quiet for longer than `heartbeatMs`, keeping intermediate
 *    proxies/load balancers from killing an idle-looking connection during a
 *    slow tool call or provider gap.
 *
 * The heartbeat timer races the source's pending `next()` call without ever
 * consuming or reordering a real event — a real event always wins the race
 * the instant it resolves, however many heartbeats fired while waiting.
 */
export async function* withSequenceAndHeartbeat<T>(
  source: AsyncIterable<T>,
  heartbeatMs: number,
): AsyncGenerator<SequencedStreamEvent<T>> {
  const iterator = source[Symbol.asyncIterator]();
  let sequence = 0;
  let nextResult = iterator.next();

  try {
    while (true) {
      const { promise: heartbeatPromise, cancel: cancelHeartbeat } = raceableDelay(
        heartbeatMs,
        HEARTBEAT,
      );

      let winner: IteratorResult<T> | typeof HEARTBEAT;
      try {
        winner = await Promise.race([nextResult, heartbeatPromise]);
      } finally {
        cancelHeartbeat();
      }

      if (winner === HEARTBEAT) {
        yield { sequence: sequence++, event: { type: 'heartbeat' } };
        continue;
      }

      const result = winner;
      if (result.done) {
        return;
      }

      yield { sequence: sequence++, event: result.value };
      nextResult = iterator.next();
    }
  } finally {
    await iterator.return?.();
  }
}

function raceableDelay<T>(ms: number, value: T): { promise: Promise<T>; cancel: () => void } {
  let timeoutHandle: ReturnType<typeof setTimeout>;
  const promise = new Promise<T>((resolve) => {
    timeoutHandle = setTimeout(() => resolve(value), ms);
  });

  return {
    promise,
    cancel: () => clearTimeout(timeoutHandle),
  };
}
