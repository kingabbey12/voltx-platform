import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { requestJson } from '../../provider/integration-http-client.util';
import { asString, asOptionalString } from '../../provider/input-coercion.util';
import { googleOAuthConfig } from '../../provider/oauth-provider-configs';
import { resolveGoogleAccountEmail } from './google-account-identity.util';
import {
  IntegrationActionContext,
  IntegrationActionDescriptor,
  IntegrationCredentialValue,
  IntegrationHealthResult,
  IntegrationParsedEvent,
  IntegrationPollResult,
  IntegrationProvider,
  IntegrationProviderError,
} from '../../provider/integration-provider.types';

const CALENDAR_BASE_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary';

interface GoogleCalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: Array<{ email: string }>;
  updated?: string;
}

interface GoogleCalendarEventListResponse {
  items?: GoogleCalendarEvent[];
}

@Injectable()
export class GoogleCalendarConnector implements IntegrationProvider {
  readonly key = 'GOOGLE_CALENDAR' as const;
  readonly authType = 'OAUTH2' as const;
  readonly displayName = 'Google Calendar';
  readonly supportsWebhooks = false;
  readonly supportsPolling = true;
  readonly oauthConfig;

  constructor(private readonly configService: ConfigService) {
    this.oauthConfig = googleOAuthConfig(configService, [
      'https://www.googleapis.com/auth/calendar.events',
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/userinfo.email',
    ]);
  }

  resolveAccountIdentity(credential: IntegrationCredentialValue): Promise<string | undefined> {
    return resolveGoogleAccountEmail(credential);
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
            description: { type: 'string', description: 'Optional event description.' },
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
        mutates: false,
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
        `${CALENDAR_BASE_URL}?maxResults=1`,
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
    const timeMin = cursor ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const list = await requestJson<GoogleCalendarEventListResponse>(
      `${CALENDAR_BASE_URL}/events?timeMin=${encodeURIComponent(timeMin)}&orderBy=updated&singleEvents=true`,
      { headers: this.authHeaders(context) },
      { signal: context.signal },
    );
    return {
      events: (list.body.items ?? []).map(toMeetingEvent),
      nextCursor: new Date().toISOString(),
    };
  }

  private async createEvent(
    input: Record<string, unknown>,
    context: IntegrationActionContext,
  ): Promise<{ id: string; htmlLink?: string }> {
    const attendees = Array.isArray(input.attendees) ? (input.attendees as string[]) : [];
    const result = await requestJson<{ id: string; htmlLink?: string }>(
      `${CALENDAR_BASE_URL}/events`,
      {
        method: 'POST',
        headers: { ...this.authHeaders(context), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          summary: asString(input.summary, ''),
          description: asOptionalString(input.description),
          start: { dateTime: asString(input.startTime, '') },
          end: { dateTime: asString(input.endTime, '') },
          attendees: attendees.map((email) => ({ email })),
        }),
      },
      { signal: context.signal },
    );
    return { id: result.body.id, htmlLink: result.body.htmlLink };
  }

  private async listEvents(
    input: Record<string, unknown>,
    context: IntegrationActionContext,
  ): Promise<{ events: Array<{ id: string; summary?: string; start?: string; end?: string }> }> {
    const timeMin = asOptionalString(input.timeMin) ?? new Date().toISOString();
    const timeMax = input.timeMax
      ? (asOptionalString(input.timeMax) ?? '')
      : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const list = await requestJson<GoogleCalendarEventListResponse>(
      `${CALENDAR_BASE_URL}/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime`,
      { headers: this.authHeaders(context) },
      { signal: context.signal },
    );

    return {
      events: (list.body.items ?? []).map((event) => ({
        id: event.id,
        summary: event.summary,
        start: event.start?.dateTime ?? event.start?.date,
        end: event.end?.dateTime ?? event.end?.date,
      })),
    };
  }

  private authHeaders(context: IntegrationActionContext): Record<string, string> {
    return { Authorization: `Bearer ${context.credential.accessToken ?? ''}` };
  }
}

function toMeetingEvent(event: GoogleCalendarEvent): IntegrationParsedEvent {
  const title = event.summary ?? '(untitled event)';
  const start = event.start?.dateTime ?? event.start?.date;
  return {
    type: 'MEETING_CREATED',
    externalId: event.id,
    occurredAt: event.updated ? new Date(event.updated) : undefined,
    payload: { id: event.id, summary: title, start, end: event.end?.dateTime ?? event.end?.date },
    knowledgeContribution: {
      sourceType: 'CALENDAR',
      title,
      contentType: 'text',
      text: `Event: ${title}\nStart: ${start ?? 'unknown'}\n${event.description ?? ''}`,
      metadata: {
        googleCalendarEventId: event.id,
        attendees: event.attendees?.map((a) => a.email),
      },
    },
  };
}
