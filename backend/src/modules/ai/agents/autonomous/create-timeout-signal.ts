export interface TimeoutSignal {
  signal: AbortSignal;
  clear: () => void;
  didTimeOut: () => boolean;
}

/**
 * Combines an overall wall-clock budget with an optional caller-provided
 * cancellation signal into a single AbortSignal. `didTimeOut()` lets callers
 * distinguish "our own budget expired" from "the caller cancelled us" after
 * the fact, since both surface as the same aborted signal.
 */
export function createTimeoutSignal(
  timeoutMs: number,
  externalSignal?: AbortSignal,
): TimeoutSignal {
  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const onExternalAbort = () => controller.abort();
  externalSignal?.addEventListener('abort', onExternalAbort);

  return {
    signal: controller.signal,
    clear: () => {
      clearTimeout(timer);
      externalSignal?.removeEventListener('abort', onExternalAbort);
    },
    didTimeOut: () => timedOut,
  };
}
