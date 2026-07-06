import { HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { AiGatewayStreamEvent } from '../gateway/ai-gateway-stream-event.types';
import { MultiAgentStreamEvent } from '../agents/autonomous/multi-agent-stream-event.types';
import { formatSseEvent } from './sse-event.formatter';
import { withSequenceAndHeartbeat } from './with-heartbeat';

const DEFAULT_HEARTBEAT_MS = 15_000;

type StreamableEvent = AiGatewayStreamEvent | MultiAgentStreamEvent;

/**
 * Shared SSE transport for the streaming conversation-message and agent-run
 * endpoints: sets streaming headers, wires client-disconnect to an
 * AbortSignal passed into the source generator, layers in sequence ids and
 * heartbeats, and writes a terminal `done`/`error` frame exactly like the
 * existing /ai/chat endpoint does — so reconnecting/parsing clients see one
 * consistent transport contract across every AI streaming endpoint. Only
 * `provider_event` unwraps to its inner event's own wire name; every other
 * event (including multi-agent coordinator events) uses its own `type`
 * directly, so this needed no logic changes to support delegation — only a
 * wider type signature.
 */
export async function writeGatewayEventStreamToResponse(
  response: Response,
  createSource: (signal: AbortSignal) => AsyncGenerator<StreamableEvent, unknown>,
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
      const wireName = event.type === 'provider_event' ? event.event.type : event.type;
      const payload = event.type === 'provider_event' ? event.event : event;
      response.write(formatSseEvent(wireName, payload, sequence));
    }

    response.write(formatSseEvent('done', { status: 'completed' }));
  } catch (error) {
    response.write(
      formatSseEvent('error', {
        code: error instanceof Error ? error.name : 'AIGatewayError',
        message: error instanceof Error ? error.message : 'AI gateway stream failed',
      }),
    );
  } finally {
    response.end();
  }
}
