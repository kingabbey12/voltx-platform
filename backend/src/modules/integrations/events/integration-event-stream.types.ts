import { IntegrationEventType } from '../provider/integration-provider.types';

export interface IntegrationStreamEvent {
  type: IntegrationEventType;
  connectionId: string;
  payload: Record<string, unknown>;
  occurredAt: string;
}
