import { HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { formatSseEvent } from './sse-event.formatter';
import { withSequenceAndHeartbeat } from './with-heartbeat';

const DEFAULT_HEARTBEAT_MS = 15_000;

/**
 * Generic SSE transport shared by every streaming admin endpoint in the
 * platform (knowledge preview/ingestion, workflow run execution, etc.):
 * sets streaming headers, wires client-disconnect to an AbortSignal passed
 * into the source generator, layers in sequence ids (as the SSE `id:`
 * field, so a reconnecting EventSource sends `Last-Event-ID` correctly)
 * and heartbeats, and writes a terminal `done`/`error` frame. Generic over
 * any event shape with a `type` field rather than tied to one module's
 * event union — this is the same contract as
 * writeGatewayEventStreamToResponse (AI Gateway/agent streaming), kept
 * separate only because that one's wire-format special-cases
 * `provider_event` unwrapping, which no other event type needs.
 */
export async function writeEventStreamToResponse<T extends { type: string }>(
  response: Response,
  createSource: (signal: AbortSignal) => AsyncGenerator<T, unknown>,
  heartbeatMs: number = DEFAULT_HEARTBEAT_MS,
): Promise<void> {
  response.status(HttpStatus.OK);
  response.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  response.setHeader('Cache-Control', 'no-cache, no-transform');
  response.setHeader('Connection', 'keep-alive');
  response.flushHeaders();

  const abortController = new AbortController();
  response.on('close', () => {
    abortController.abort();
  });

  try {
    for await (const { sequence, event } of withSequenceAndHeartbeat(
      createSource(abortController.signal),
      heartbeatMs,
    )) {
      response.write(formatSseEvent(event.type, event, sequence));
    }

    response.write(formatSseEvent('done', { status: 'completed' }));
  } catch (error) {
    response.write(
      formatSseEvent('error', {
        code: error instanceof Error ? error.name : 'StreamError',
        message: error instanceof Error ? error.message : 'Event stream failed',
      }),
    );
  } finally {
    response.end();
  }
}
