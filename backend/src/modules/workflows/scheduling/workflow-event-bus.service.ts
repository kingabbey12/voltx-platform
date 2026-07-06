import { Injectable } from '@nestjs/common';
import { EventEmitter } from 'node:events';

/**
 * Minimal in-process pub/sub for EVENT-triggered workflow schedules — no
 * new dependency (Node's built-in EventEmitter) since this only needs to
 * fan out within a single process, matching the rest of this engine's
 * single-instance assumptions (same as the in-memory AbortController map
 * in WorkflowEngineService). Any part of the platform can call `emit` to
 * fire matching EVENT schedules; WorkflowSchedulerService is the only
 * subscriber.
 */
@Injectable()
export class WorkflowEventBusService {
  private readonly emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(100);
  }

  emit(eventName: string, payload: Record<string, unknown> = {}): void {
    this.emitter.emit('workflow-event', eventName, payload);
  }

  onEvent(listener: (eventName: string, payload: Record<string, unknown>) => void): void {
    this.emitter.on('workflow-event', listener);
  }
}
