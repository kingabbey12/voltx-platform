import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { requestJson } from '../../integrations/provider/integration-http-client.util';
import {
  ChannelActionContext,
  ChannelProvider,
  ChannelProviderError,
  CommsCredentialValue,
  OutboundMessageInput,
  OutboundMessageResult,
} from '../channels/channel-provider.interface';
import { verifyTwilioSignature } from './twilio-signature.util';

const TWILIO_API_BASE_URL = 'https://api.twilio.com/2010-04-01';

interface TwilioCallResponse {
  sid?: string;
  status?: string;
  error_message?: string;
}

/**
 * Real Twilio Programmable Voice integration. Voice is structurally
 * different from every other channel here — a phone call is not a text
 * message, so unlike Gmail/Slack/Outlook/Teams/WhatsApp/Twilio SMS this
 * provider does NOT implement parseInboundWebhook/poll into the unified
 * CommsMessage timeline. Inbound call events (ringing, answered,
 * completed, recording ready) are handled by TwilioVoiceWebhookController
 * directly against CallRepository — see that controller for why. sendMessage
 * here means "place an outbound call and speak this text" (TwiML <Say>),
 * a deliberate, narrow interpretation of the generic
 * ChannelProvider.sendMessage contract for a channel whose "message" is a
 * phone call rather than a chat bubble.
 */
@Injectable()
export class TwilioVoiceChannelProvider implements ChannelProvider {
  readonly channel = 'TWILIO_VOICE' as const;
  readonly displayName = 'Voice (Twilio)';
  readonly authType = 'API_KEY' as const;
  readonly supportsWebhooks = true;
  readonly supportsPolling = false;

  constructor(private readonly configService: ConfigService) {}

  async sendMessage(
    input: OutboundMessageInput,
    context: ChannelActionContext,
  ): Promise<OutboundMessageResult> {
    const { accountSid, phoneNumber } = this.credentialFields(context.credential);
    const webhookBaseUrl = this.configService.get<string>('integrations.webhookBaseUrl', '');

    const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Say>${escapeXml(input.body)}</Say></Response>`;
    const form = new URLSearchParams({
      To: input.to,
      From: phoneNumber,
      Twiml: twiml,
      StatusCallback: `${webhookBaseUrl}/api/v1/communications/webhooks/twilio/voice/status`,
    });

    const result = await requestJson<TwilioCallResponse>(
      `${TWILIO_API_BASE_URL}/Accounts/${accountSid}/Calls.json`,
      {
        method: 'POST',
        headers: {
          ...this.authHeaders(accountSid, context.credential),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: form.toString(),
      },
      { signal: context.signal },
    );

    if (!result.body.sid) {
      throw new ChannelProviderError(
        `Twilio call initiation failed: ${result.body.error_message ?? 'no call sid returned'}`,
        'twilio_api_error',
      );
    }
    return { externalId: result.body.sid, status: 'SENT' };
  }

  verifyWebhookSignature(
    headers: Record<string, string>,
    rawBody: string,
    secret: string,
    requestUrl?: string,
  ): boolean {
    if (!requestUrl) return false;
    return verifyTwilioSignature(requestUrl, rawBody, headers['x-twilio-signature'], secret);
  }

  resolveAccountIdentity(credential: CommsCredentialValue): Promise<string | undefined> {
    return Promise.resolve((credential.extra as { phoneNumber?: string } | undefined)?.phoneNumber);
  }

  private credentialFields(credential: CommsCredentialValue): {
    accountSid: string;
    phoneNumber: string;
  } {
    const extra = credential.extra as { accountSid?: string; phoneNumber?: string } | undefined;
    if (!extra?.accountSid || !extra.phoneNumber) {
      throw new ChannelProviderError(
        'This Twilio connection is missing its account SID or phone number',
        'missing_config',
      );
    }
    return { accountSid: extra.accountSid, phoneNumber: extra.phoneNumber };
  }

  private authHeaders(
    accountSid: string,
    credential: CommsCredentialValue,
  ): Record<string, string> {
    const token = Buffer.from(`${accountSid}:${credential.apiKey ?? ''}`).toString('base64');
    return { Authorization: `Basic ${token}` };
  }
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
