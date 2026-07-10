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
  ParsedInboundAttachment,
  ParsedInboundMessage,
  ParsedStatusUpdate,
} from '../channels/channel-provider.interface';
import { verifyTwilioSignature } from './twilio-signature.util';

const TWILIO_SMS_STATUS_MAP: Record<string, ParsedStatusUpdate['status']> = {
  delivered: 'DELIVERED',
  read: 'READ',
  failed: 'FAILED',
  undelivered: 'FAILED',
};

const TWILIO_API_BASE_URL = 'https://api.twilio.com/2010-04-01';

interface TwilioMessageResponse {
  sid?: string;
  status?: string;
  error_message?: string;
}

/**
 * Real Twilio Programmable Messaging (SMS/MMS) integration. Like
 * WhatsApp, this is API_KEY-authenticated (Account SID + Auth Token, both
 * per-connection) with no separate AI-tool connector to delegate to, so
 * it talks to Twilio's REST API directly. Twilio's webhook signing scheme
 * is meaningfully different from every other channel here (see
 * twilio-signature.util.ts) and its MMS attachments are sent as public
 * URLs rather than uploaded bytes, unlike every other channel's
 * attachment mechanism.
 */
@Injectable()
export class TwilioSmsChannelProvider implements ChannelProvider {
  readonly channel = 'TWILIO_SMS' as const;
  readonly displayName = 'SMS (Twilio)';
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

    const form = new URLSearchParams({
      To: input.to,
      From: phoneNumber,
      Body: input.body,
      StatusCallback: `${webhookBaseUrl}/api/v1/communications/webhooks/twilio/sms`,
    });
    for (const attachment of input.attachments ?? []) {
      form.append('MediaUrl', attachment.signedUrl);
    }

    const result = await requestJson<TwilioMessageResponse>(
      `${TWILIO_API_BASE_URL}/Accounts/${accountSid}/Messages.json`,
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
        `Twilio SMS send failed: ${result.body.error_message ?? 'no message sid returned'}`,
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

  async parseInboundWebhook(
    headers: Record<string, string>,
    rawBody: string,
    context: ChannelActionContext,
  ): Promise<ParsedInboundMessage[]> {
    const params = new URLSearchParams(rawBody);
    // A status callback (MessageStatus present) hits this same endpoint —
    // it has no message content, only a delivery/read/failure state for a
    // message we already sent, handled by parseInboundStatusUpdates instead.
    if (params.has('MessageStatus')) return [];

    const messageSid = params.get('MessageSid') ?? params.get('SmsSid');
    const from = params.get('From');
    if (!messageSid || !from) return [];

    const numMedia = Number(params.get('NumMedia') ?? '0');
    const attachments: ParsedInboundAttachment[] = [];
    const { accountSid } = this.credentialFields(context.credential);

    for (let index = 0; index < numMedia; index += 1) {
      const mediaUrl = params.get(`MediaUrl${index}`);
      const contentType = params.get(`MediaContentType${index}`) ?? 'application/octet-stream';
      if (!mediaUrl) continue;

      const downloaded = await this.downloadMedia(mediaUrl, accountSid, context.credential);
      if (downloaded) attachments.push({ ...downloaded, mimeType: contentType });
    }

    return [
      {
        externalId: messageSid,
        externalThreadId: from,
        fromAddress: from,
        body: params.get('Body') ?? '',
        attachments: attachments.length > 0 ? attachments : undefined,
      },
    ];
  }

  resolveAccountIdentity(credential: CommsCredentialValue): Promise<string | undefined> {
    return Promise.resolve((credential.extra as { phoneNumber?: string } | undefined)?.phoneNumber);
  }

  /** Twilio's status callback — MessageStatus (queued/sent/delivered/undelivered/failed) plus the MessageSid we returned as externalId at send time. */
  parseInboundStatusUpdates(
    _headers: Record<string, string>,
    rawBody: string,
  ): ParsedStatusUpdate[] {
    const params = new URLSearchParams(rawBody);
    const messageSid = params.get('MessageSid') ?? params.get('SmsSid');
    const status = params.get('MessageStatus');
    if (!messageSid || !status) return [];

    const mapped = TWILIO_SMS_STATUS_MAP[status];
    if (!mapped) return [];

    return [{ externalId: messageSid, status: mapped }];
  }

  private async downloadMedia(
    mediaUrl: string,
    accountSid: string,
    credential: CommsCredentialValue,
  ): Promise<Omit<ParsedInboundAttachment, 'mimeType'> | undefined> {
    try {
      const response = await fetch(mediaUrl, { headers: this.authHeaders(accountSid, credential) });
      if (!response.ok) return undefined;
      const buffer = Buffer.from(await response.arrayBuffer());
      const fileName = mediaUrl.split('/').pop() ?? 'attachment';
      return { fileName, buffer };
    } catch {
      return undefined;
    }
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
