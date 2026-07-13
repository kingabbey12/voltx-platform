/**
 * Every event type Voltx can emit to an outbound webhook endpoint. A
 * developer's WebhookEndpoint.eventTypes must be a subset of these keys
 * (validated at registration time). Publishers call
 * WebhookDispatchService.publish(eventType, organizationId, payload) from
 * existing domain code — see leads.service.ts, workflow-engine.service.ts,
 * and oauth-authorization.service.ts for the current call sites. Adding a
 * new event type never requires a schema change, only a new catalog entry
 * and a publish() call at the relevant domain call site.
 */
export const WEBHOOK_EVENT_CATALOG = [
  {
    key: 'sales.lead.created',
    description: 'A new sales lead was created',
  },
  {
    key: 'workflow.run.completed',
    description: 'A workflow run finished successfully',
  },
  {
    key: 'workflow.run.failed',
    description: 'A workflow run finished with a failure',
  },
  {
    key: 'oauth_application.authorized',
    description: 'A user approved an OAuth application to act on their behalf',
  },
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_CATALOG)[number]['key'];

export const WEBHOOK_EVENT_TYPES: readonly WebhookEventType[] = WEBHOOK_EVENT_CATALOG.map(
  (event) => event.key,
);

export function isKnownWebhookEventType(value: string): value is WebhookEventType {
  return (WEBHOOK_EVENT_TYPES as readonly string[]).includes(value);
}
