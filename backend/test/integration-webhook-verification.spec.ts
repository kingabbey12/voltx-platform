import { createHmac } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { SlackConnector } from '../src/modules/integrations/connectors/slack/slack.connector';
import { GitHubConnector } from '../src/modules/integrations/connectors/github/github.connector';
import { StripeConnector } from '../src/modules/integrations/connectors/stripe/stripe.connector';
import { MicrosoftTeamsConnector } from '../src/modules/integrations/connectors/teams/microsoft-teams.connector';
import { GenericWebhookConnector } from '../src/modules/integrations/connectors/webhook/generic-webhook.connector';

function fakeConfigService(): ConfigService {
  return { get: jest.fn().mockReturnValue('') } as never;
}

describe('Webhook signature verification', () => {
  describe('SlackConnector', () => {
    const connector = new SlackConnector(fakeConfigService());
    const secret = 'slack-signing-secret';

    function sign(timestamp: string, body: string): string {
      return `v0=${createHmac('sha256', secret).update(`v0:${timestamp}:${body}`).digest('hex')}`;
    }

    it('accepts a correctly signed request within the time window', () => {
      const timestamp = String(Math.floor(Date.now() / 1000));
      const body = JSON.stringify({ event: { type: 'message' } });
      const headers = {
        'x-slack-request-timestamp': timestamp,
        'x-slack-signature': sign(timestamp, body),
      };
      expect(connector.verifyWebhookSignature(headers, body, secret)).toBe(true);
    });

    it('rejects an incorrect signature', () => {
      const timestamp = String(Math.floor(Date.now() / 1000));
      const body = JSON.stringify({ event: {} });
      const headers = {
        'x-slack-request-timestamp': timestamp,
        'x-slack-signature': 'v0=deadbeef',
      };
      expect(connector.verifyWebhookSignature(headers, body, secret)).toBe(false);
    });

    it('rejects a request signed with the wrong secret', () => {
      const timestamp = String(Math.floor(Date.now() / 1000));
      const body = JSON.stringify({ event: {} });
      const wrongSecretSignature = `v0=${createHmac('sha256', 'wrong-secret').update(`v0:${timestamp}:${body}`).digest('hex')}`;
      const headers = {
        'x-slack-request-timestamp': timestamp,
        'x-slack-signature': wrongSecretSignature,
      };
      expect(connector.verifyWebhookSignature(headers, body, secret)).toBe(false);
    });

    it('rejects a stale timestamp outside the replay window', () => {
      const staleTimestamp = String(Math.floor(Date.now() / 1000) - 10 * 60);
      const body = JSON.stringify({ event: {} });
      const headers = {
        'x-slack-request-timestamp': staleTimestamp,
        'x-slack-signature': sign(staleTimestamp, body),
      };
      expect(connector.verifyWebhookSignature(headers, body, secret)).toBe(false);
    });

    it('rejects a request missing the signature headers', () => {
      expect(connector.verifyWebhookSignature({}, '{}', secret)).toBe(false);
    });

    it('parses a message event into a SLACK_MESSAGE with a knowledge contribution', () => {
      const body = JSON.stringify({
        event: {
          type: 'message',
          channel: 'C123',
          user: 'U456',
          text: 'hello team',
          ts: '1234.5678',
        },
      });
      const events = connector.parseWebhookPayload({}, body);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('SLACK_MESSAGE');
      expect(events[0].externalId).toBe('1234.5678');
      expect(events[0].knowledgeContribution?.sourceType).toBe('MESSAGE');
    });

    it('ignores a URL verification challenge payload', () => {
      const events = connector.parseWebhookPayload(
        {},
        JSON.stringify({ type: 'url_verification', challenge: 'abc' }),
      );
      expect(events).toHaveLength(0);
    });
  });

  describe('GitHubConnector', () => {
    const connector = new GitHubConnector(fakeConfigService());
    const secret = 'github-webhook-secret';

    function sign(body: string): string {
      return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
    }

    it('accepts a correctly signed request', () => {
      const body = JSON.stringify({ action: 'opened' });
      expect(
        connector.verifyWebhookSignature({ 'x-hub-signature-256': sign(body) }, body, secret),
      ).toBe(true);
    });

    it('rejects a missing signature header', () => {
      expect(connector.verifyWebhookSignature({}, '{}', secret)).toBe(false);
    });

    it('rejects an incorrect signature', () => {
      expect(
        connector.verifyWebhookSignature({ 'x-hub-signature-256': 'sha256=bad' }, '{}', secret),
      ).toBe(false);
    });

    it('parses an issues event into a GITHUB_ISSUE with a knowledge contribution', () => {
      const body = JSON.stringify({
        action: 'opened',
        issue: {
          number: 42,
          title: 'Bug found',
          html_url: 'https://github.com/x/y/issues/42',
          body: 'details',
        },
        repository: { full_name: 'x/y' },
      });
      const events = connector.parseWebhookPayload({ 'x-github-event': 'issues' }, body);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('GITHUB_ISSUE');
      expect(events[0].externalId).toBe('42');
      expect(events[0].knowledgeContribution?.sourceType).toBe('ISSUE');
    });

    it('ignores non-issues event types', () => {
      const events = connector.parseWebhookPayload(
        { 'x-github-event': 'push' },
        JSON.stringify({}),
      );
      expect(events).toHaveLength(0);
    });
  });

  describe('StripeConnector', () => {
    const connector = new StripeConnector();
    const secret = 'stripe-webhook-secret';

    function sign(timestamp: number, body: string): string {
      const signature = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
      return `t=${timestamp},v1=${signature}`;
    }

    it('accepts a correctly signed event', () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const body = JSON.stringify({
        id: 'evt_1',
        type: 'payment_intent.succeeded',
        created: timestamp,
        data: { object: { id: 'pi_1', amount: 5000, currency: 'usd' } },
      });
      expect(
        connector.verifyWebhookSignature(
          { 'stripe-signature': sign(timestamp, body) },
          body,
          secret,
        ),
      ).toBe(true);
    });

    it('rejects a request with a tampered body', () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const originalBody = JSON.stringify({ amount: 100 });
      const tamperedBody = JSON.stringify({ amount: 999999 });
      expect(
        connector.verifyWebhookSignature(
          { 'stripe-signature': sign(timestamp, originalBody) },
          tamperedBody,
          secret,
        ),
      ).toBe(false);
    });

    it('rejects a stale timestamp', () => {
      const staleTimestamp = Math.floor(Date.now() / 1000) - 10 * 60;
      const body = JSON.stringify({});
      expect(
        connector.verifyWebhookSignature(
          { 'stripe-signature': sign(staleTimestamp, body) },
          body,
          secret,
        ),
      ).toBe(false);
    });

    it('parses a payment_intent.succeeded event into PAYMENT_RECEIVED', () => {
      const timestamp = Math.floor(Date.now() / 1000);
      const body = JSON.stringify({
        id: 'evt_1',
        type: 'payment_intent.succeeded',
        created: timestamp,
        data: { object: { id: 'pi_1', amount: 5000, currency: 'usd', customer: 'cus_1' } },
      });
      const events = connector.parseWebhookPayload({}, body);
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('PAYMENT_RECEIVED');
      expect(events[0].payload.amount).toBe(5000);
    });

    it('ignores unrelated event types', () => {
      const body = JSON.stringify({
        id: 'evt_2',
        type: 'customer.created',
        created: 0,
        data: { object: {} },
      });
      expect(connector.parseWebhookPayload({}, body)).toHaveLength(0);
    });
  });

  describe('MicrosoftTeamsConnector', () => {
    const connector = new MicrosoftTeamsConnector(fakeConfigService());
    const secret = 'teams-client-state';

    it('accepts a notification whose clientState matches', () => {
      const body = JSON.stringify({ value: [{ clientState: secret, resource: 'teams/messages' }] });
      expect(connector.verifyWebhookSignature({}, body, secret)).toBe(true);
    });

    it('rejects a notification with a mismatched clientState', () => {
      const body = JSON.stringify({
        value: [{ clientState: 'wrong', resource: 'teams/messages' }],
      });
      expect(connector.verifyWebhookSignature({}, body, secret)).toBe(false);
    });

    it('rejects a malformed payload', () => {
      expect(connector.verifyWebhookSignature({}, 'not json', secret)).toBe(false);
    });
  });

  describe('GenericWebhookConnector', () => {
    const connector = new GenericWebhookConnector();
    const secret = 'generic-shared-secret';

    it('accepts a correctly signed payload', () => {
      const body = JSON.stringify({ id: 'evt-1', foo: 'bar' });
      const signature = createHmac('sha256', secret).update(body).digest('hex');
      expect(
        connector.verifyWebhookSignature({ 'x-voltx-signature': signature }, body, secret),
      ).toBe(true);
    });

    it('rejects an incorrect signature', () => {
      expect(connector.verifyWebhookSignature({ 'x-voltx-signature': 'bad' }, '{}', secret)).toBe(
        false,
      );
    });

    it('parses any payload into a WEBHOOK_RECEIVED event', () => {
      const events = connector.parseWebhookPayload({}, JSON.stringify({ id: 'evt-1', foo: 'bar' }));
      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('WEBHOOK_RECEIVED');
      expect(events[0].externalId).toBe('evt-1');
    });
  });
});
