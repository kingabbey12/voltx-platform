import { Injectable } from '@nestjs/common';
import { IntegrationBusEvent, IntegrationEventBusService } from './integration-event-bus.service';
import { IntegrationStreamEvent } from './integration-event-stream.types';

/**
 * Bridges the in-process event bus into an async generator so integration
 * events can be consumed live over SSE via writeEventStreamToResponse
 * (the same generic writer promoted in VT-024) — the "one implementation,
 * two consumption modes" convention used everywhere else in this
 * codebase, applied here to a push-based EventEmitter source instead of
 * an async pipeline.
 */
@Injectable()
export class IntegrationEventStreamService {
  constructor(private readonly integrationEventBusService: IntegrationEventBusService) {}

  async *streamForOrganization(
    organizationId: string,
    signal: AbortSignal,
  ): AsyncGenerator<IntegrationStreamEvent, void> {
    const queue: IntegrationBusEvent[] = [];
    let resolveWaiter: (() => void) | null = null;

    const unsubscribe = this.integrationEventBusService.subscribe((event) => {
      if (event.organizationId !== organizationId) {
        return;
      }
      queue.push(event);
      resolveWaiter?.();
      resolveWaiter = null;
    });

    try {
      while (!signal.aborted) {
        if (queue.length === 0) {
          await new Promise<void>((resolve) => {
            resolveWaiter = resolve;
            signal.addEventListener('abort', () => resolve(), { once: true });
          });
          continue;
        }

        const event = queue.shift();
        if (!event) {
          continue;
        }
        yield {
          type: event.type,
          connectionId: event.connectionId,
          payload: event.payload,
          occurredAt: event.occurredAt,
        };
      }
    } finally {
      unsubscribe();
    }
  }
}
