import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { requestJson } from '../../provider/integration-http-client.util';
import { asString, asOptionalString } from '../../provider/input-coercion.util';
import { microsoftOAuthConfig } from '../../provider/oauth-provider-configs';
import {
  IntegrationActionContext,
  IntegrationActionDescriptor,
  IntegrationHealthResult,
  IntegrationParsedEvent,
  IntegrationPollResult,
  IntegrationProvider,
  IntegrationProviderError,
} from '../../provider/integration-provider.types';

const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0/me';

interface OutlookEvent {
  id: string;
  subject?: string;
  bodyPreview?: string;
  start?: { dateTime?: string };
  end?: { dateTime?: string };
  attendees?: Array<{ emailAddress?: { address?: string } }>;
  lastModifiedDateTime?: string;
}

interface OutlookEventListResponse {
  value?: OutlookEvent[];
}

@Injectable()
export class MicrosoftCalendarConnector implements IntegrationProvider {
  readonly key = 'MICROSOFT_CALENDAR' as const;
  readonly authType = 'OAUTH2' as const;
  readonly displayName = 'Microsoft Calendar';
  readonly supportsWebhooks = false;
  readonly supportsPolling = true;
  readonly oauthConfig;

  constructor(private readonly configService: ConfigService) {
    this.oauthConfig = microsoftOAuthConfig(configService, ['Calendars.ReadWrite']);
  }

  listActions(): IntegrationActionDescriptor[] {
    return [
      {
        name: 'create_event',
        description: 'Create (schedule) a calendar event/meeting.',
        inputSchema: {
          type: 'object',
          properties: {
            summary: { type: 'string', description: 'Event title.', required: true },
            startTime: { type: 'string', description: 'ISO 8601 start time.', required: true },
            endTime: { type: 'string', description: 'ISO 8601 end time.', required: true },
            attendees: { type: 'array', description: 'Optional list of attendee email addresses.' },
          },
        },
      },
      {
        name: 'list_events',
        description: 'Read upcoming calendar events in a time window.',
        inputSchema: {
          type: 'object',
          properties: {
            timeMin: { type: 'string', description: 'ISO 8601 lower bound, defaults to now.' },
            timeMax: {
              type: 'string',
              description: 'ISO 8601 upper bound, defaults to 7 days from now.',
            },
          },
        },
      },
    ];
  }

  async executeAction(
    actionName: string,
    input: Record<string, unknown>,
    context: IntegrationActionContext,
  ): Promise<unknown> {
    switch (actionName) {
      case 'create_event':
        return this.createEvent(input, context);
      case 'list_events':
        return this.listEvents(input, context);
      default:
        throw new IntegrationProviderError(
          `Unknown Calendar action "${actionName}"`,
          'unknown_action',
        );
    }
  }

  async checkHealth(context: IntegrationActionContext): Promise<IntegrationHealthResult> {
    const startedAt = Date.now();
    try {
      await requestJson(
        `${GRAPH_BASE_URL}/calendar`,
        { headers: this.authHeaders(context) },
        { signal: context.signal },
      );
      return { healthy: true, latencyMs: Date.now() - startedAt };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - startedAt,
        message: error instanceof Error ? error.message : 'Calendar health check failed',
      };
    }
  }

  async poll(context: IntegrationActionContext, cursor?: string): Promise<IntegrationPollResult> {
    const since = cursor ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const list = await requestJson<OutlookEventListResponse>(
      `${GRAPH_BASE_URL}/events?$filter=${encodeURIComponent(`lastModifiedDateTime ge ${since}`)}`,
      { headers: this.authHeaders(context) },
      { signal: context.signal },
    );
    return {
      events: (list.body.value ?? []).map(toMeetingEvent),
      nextCursor: new Date().toISOString(),
    };
  }

  private async createEvent(
    input: Record<string, unknown>,
    context: IntegrationActionContext,
  ): Promise<{ id: string; webLink?: string }> {
    const attendees = Array.isArray(input.attendees) ? (input.attendees as string[]) : [];
    const result = await requestJson<{ id: string; webLink?: string }>(
      `${GRAPH_BASE_URL}/events`,
      {
        method: 'POST',
        headers: { ...this.authHeaders(context), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: asString(input.summary, ''),
          start: { dateTime: asString(input.startTime, ''), timeZone: 'UTC' },
          end: { dateTime: asString(input.endTime, ''), timeZone: 'UTC' },
          attendees: attendees.map((email) => ({
            emailAddress: { address: email },
            type: 'required',
          })),
        }),
      },
      { signal: context.signal },
    );
    return { id: result.body.id, webLink: result.body.webLink };
  }

  private async listEvents(
    input: Record<string, unknown>,
    context: IntegrationActionContext,
  ): Promise<{ events: Array<{ id: string; subject?: string; start?: string; end?: string }> }> {
    const timeMin = asOptionalString(input.timeMin) ?? new Date().toISOString();
    const timeMax = input.timeMax
      ? (asOptionalString(input.timeMax) ?? '')
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const list = await requestJson<OutlookEventListResponse>(
      `${GRAPH_BASE_URL}/calendarView?startDateTime=${encodeURIComponent(timeMin)}&endDateTime=${encodeURIComponent(timeMax)}`,
      { headers: this.authHeaders(context) },
      { signal: context.signal },
    );
    return {
      events: (list.body.value ?? []).map((event) => ({
        id: event.id,
        subject: event.subject,
        start: event.start?.dateTime,
        end: event.end?.dateTime,
      })),
    };
  }

  private authHeaders(context: IntegrationActionContext): Record<string, string> {
    return { Authorization: `Bearer ${context.credential.accessToken ?? ''}` };
  }
}

function toMeetingEvent(event: OutlookEvent): IntegrationParsedEvent {
  const title = event.subject ?? '(untitled event)';
  return {
    type: 'MEETING_CREATED',
    externalId: event.id,
    occurredAt: event.lastModifiedDateTime ? new Date(event.lastModifiedDateTime) : undefined,
    payload: {
      id: event.id,
      subject: title,
      start: event.start?.dateTime,
      end: event.end?.dateTime,
    },
    knowledgeContribution: {
      sourceType: 'CALENDAR',
      title,
      contentType: 'text',
      text: `Event: ${title}\nStart: ${event.start?.dateTime ?? 'unknown'}\n${event.bodyPreview ?? ''}`,
      metadata: {
        outlookEventId: event.id,
        attendees: event.attendees?.map((a) => a.emailAddress?.address).filter(Boolean),
      },
    },
  };
}
