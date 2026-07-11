import { Injectable, OnModuleInit } from '@nestjs/common';
import { WorkflowEventBusService } from '../../workflows/scheduling/workflow-event-bus.service';
import {
  IntegrationBusEvent,
  IntegrationEventBusService,
} from '../events/integration-event-bus.service';

/**
 * Bridges IntegrationEventBusService (Gmail/Outlook/Slack/Teams/GitHub/
 * Stripe connector activity, published by IntegrationDispatcherService)
 * into WorkflowEventBusService (the EVENT-triggered WorkflowSchedule
 * mechanism, which had zero producers before this) — the one piece
 * IntegrationEventBusService's own doc comment already called out as
 * intended ("EVENT-triggered workflow schedules") but nothing
 * implemented. WhatsApp/SMS/voice activity is a separate Communications-
 * module concept (Twilio channel providers, not an Integrations
 * connector) and is bridged independently at its own webhook controllers
 * — see WHATSAPP_RECEIVED/SMS_RECEIVED/VOICE_COMPLETED in those files.
 *
 * Lives in the Integrations module rather than the Workflows module
 * specifically to avoid a new circular import: IntegrationModule already
 * imports WorkflowModule (to register IntegrationStepExecutor into
 * StepExecutorRegistry), so the reverse import would cycle; subscribing
 * from this side needs no new edge since WorkflowEventBusService is
 * @Global().
 */
@Injectable()
export class IntegrationWorkflowEventBridgeService implements OnModuleInit {
  constructor(
    private readonly integrationEventBus: IntegrationEventBusService,
    private readonly workflowEventBus: WorkflowEventBusService,
  ) {}

  onModuleInit(): void {
    this.integrationEventBus.subscribe((event) => this.forward(event));
  }

  private forward(event: IntegrationBusEvent): void {
    this.workflowEventBus.emit(event.type, {
      organizationId: event.organizationId,
      connectionId: event.connectionId,
      occurredAt: event.occurredAt,
      ...event.payload,
    });
  }
}
