import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import { IntegrationEventType } from '../provider/integration-provider.types';

export interface IntegrationBusEvent {
  organizationId: string;
  connectionId: string;
  type: IntegrationEventType;
  payload: Record<string, unknown>;
  occurredAt: string;
}

/**
 * In-process pub/sub for integration events — same minimal EventEmitter
 * wrapper convention as WorkflowEventBusService (VT-024), reused here
 * rather than introducing a new dependency. IntegrationDispatcherService
 * is the sole publisher (called after persisting an IntegrationEvent
 * row); any number of subscribers can listen, e.g. the SSE stream
 * endpoint and EVENT-triggered workflow schedules.
 */
@Injectable()
export class IntegrationEventBusService {
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(200);
  }

  publish(event: IntegrationBusEvent): void {
    this.emitter.emit('integration-event', event);
  }

  subscribe(listener: (event: IntegrationBusEvent) => void): () => void {
    this.emitter.on('integration-event', listener);
    return () => this.emitter.off('integration-event', listener);
  }
}
