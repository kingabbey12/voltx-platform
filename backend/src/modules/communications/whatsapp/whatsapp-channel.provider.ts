import { createHmac } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { requestJson } from '../../integrations/provider/integration-http-client.util';
import { EncryptionService } from '../../integrations/security/encryption.service';
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

const GRAPH_API_VERSION = 'v20.0';
const GRAPH_BASE_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

interface WhatsAppMediaUploadResponse {
  id?: string;
  error?: { message?: string };
}

interface WhatsAppSendResponse {
  messages?: Array<{ id: string }>;
  error?: { message?: string };
}

interface WhatsAppMediaUrlResponse {
  url?: string;
  mime_type?: string;
}

interface WhatsAppInboundMedia {
  id: string;
  mime_type?: string;
  filename?: string;
}

interface WhatsAppInboundTextMessage {
  from: string;
  id: string;
  timestamp: string;
  type: string;
  text?: { body?: string };
  image?: WhatsAppInboundMedia;
  document?: WhatsAppInboundMedia;
  audio?: WhatsAppInboundMedia;
  video?: WhatsAppInboundMedia;
}

interface WhatsAppInboundStatus {
  id: string;
  status: string;
  timestamp: string;
}

interface WhatsAppWebhookPayload {
  entry?: Array<{
    changes?: Array<{
      value?: {
        metadata?: { phone_number_id?: string };
        contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
        messages?: WhatsAppInboundTextMessage[];
        statuses?: WhatsAppInboundStatus[];
      };
    }>;
  }>;
}

const MEDIA_MESSAGE_TYPES = ['image', 'document', 'audio', 'video'] as const;

const WHATSAPP_STATUS_MAP: Record<string, ParsedStatusUpdate['status']> = {
  delivered: 'DELIVERED',
  read: 'READ',
  failed: 'FAILED',
};

/**
 * Real WhatsApp Business Cloud API integration (Meta Graph API) — unlike
 * Gmail/Slack/Outlook/Teams there is no separate AI-tool "integration"
 * connector to delegate to, so this talks to the Graph API directly.
 * API_KEY auth (a per-connection permanent access token + phone number
 * id), not OAuth2 — matches the platform's usual "connect with
 * credentials" flow for this class of provider (see
 * ChannelConnectionService.createApiKeyConnection). Webhook signature
 * verification uses one Meta-App-wide secret (WHATSAPP_APP_SECRET), not a
 * per-connection one — every connected WhatsApp number shares the same
 * Meta App and therefore the same signing secret, unlike Twilio where
 * each connection has its own Auth Token.
 */
@Injectable()
export class WhatsAppChannelProvider implements ChannelProvider {
  readonly channel = 'WHATSAPP' as const;
  readonly displayName = 'WhatsApp Business';
  readonly authType = 'API_KEY' as const;
  readonly supportsWebhooks = true;
  readonly supportsPolling = false;

  async sendMessage(
    input: OutboundMessageInput,
    context: ChannelActionContext,
  ): Promise<OutboundMessageResult> {
    const phoneNumberId = this.phoneNumberId(context.credential);

    // WhatsApp only allows one media attachment per message — if there
    // are several, each becomes its own outbound message; the caption
    // (our text body) rides along on the first one only, matching how a
    // human sending WhatsApp media with a caption would do it.
    if (input.attachments?.length) {
      const messageIds: string[] = [];
      for (const [index, attachment] of input.attachments.entries()) {
        const mediaId = await this.uploadMedia(phoneNumberId, attachment, context);
        const result = await this.sendMediaMessage(
          phoneNumberId,
          input.to,
          mediaId,
          mimeToMessageType(attachment.mimeType),
          index === 0 ? input.body : undefined,
          context,
        );
        messageIds.push(result);
      }
      return { externalId: messageIds[0], status: 'SENT' };
    }

    const result = await requestJson<WhatsAppSendResponse>(
      `${GRAPH_BASE_URL}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: this.authHeaders(context),
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: input.to,
          type: 'text',
          text: { body: input.body },
        }),
      },
      { signal: context.signal },
    );

    const messageId = result.body.messages?.[0]?.id;
    if (!messageId) {
      throw new ChannelProviderError(
        `WhatsApp send failed: ${result.body.error?.message ?? 'no message id returned'}`,
        'whatsapp_api_error',
      );
    }
    return { externalId: messageId, status: 'SENT' };
  }

  /** Meta's `X-Hub-Signature-256: sha256={hmac}` header, HMAC-SHA256 over the raw body with the one Meta-App-wide secret. */
  verifyWebhookSignature(
    headers: Record<string, string>,
    rawBody: string,
    secret: string,
  ): boolean {
    const header = headers['x-hub-signature-256'];
    if (!header?.startsWith('sha256=')) return false;
    const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
    return EncryptionService.safeEqual(expected, header);
  }

  async parseInboundWebhook(
    headers: Record<string, string>,
    rawBody: string,
    context: ChannelActionContext,
  ): Promise<ParsedInboundMessage[]> {
    const payload = JSON.parse(rawBody) as WhatsAppWebhookPayload;
    const messages: ParsedInboundMessage[] = [];

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        if (!value?.messages) continue;

        const contactName = value.contacts?.[0]?.profile?.name;
        for (const message of value.messages) {
          const media = MEDIA_MESSAGE_TYPES.map((type) => message[type])
            .filter((candidate): candidate is WhatsAppInboundMedia => Boolean(candidate))
            .at(0);

          const attachments: ParsedInboundAttachment[] = [];
          if (media) {
            const downloaded = await this.downloadMedia(media, context);
            if (downloaded) attachments.push(downloaded);
          }

          messages.push({
            externalId: message.id,
            externalThreadId: message.from,
            fromAddress: message.from,
            fromDisplayName: contactName,
            body: message.text?.body ?? (media ? '' : ''),
            occurredAt: new Date(Number(message.timestamp) * 1000),
            attachments: attachments.length > 0 ? attachments : undefined,
          });
        }
      }
    }

    return messages;
  }

  resolveAccountIdentity(credential: CommsCredentialValue): Promise<string | undefined> {
    return Promise.resolve(
      (credential.extra as { phoneNumberId?: string } | undefined)?.phoneNumberId,
    );
  }

  /** Meta delivers delivery/read receipts as a `statuses` array sibling to `messages` in the same webhook payload — never mixed into the same entry as an inbound message. */
  parseInboundStatusUpdates(
    _headers: Record<string, string>,
    rawBody: string,
  ): ParsedStatusUpdate[] {
    const payload = JSON.parse(rawBody) as WhatsAppWebhookPayload;
    const updates: ParsedStatusUpdate[] = [];

    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        for (const status of change.value?.statuses ?? []) {
          const mapped = WHATSAPP_STATUS_MAP[status.status];
          if (!mapped) continue;
          updates.push({
            externalId: status.id,
            status: mapped,
            occurredAt: new Date(Number(status.timestamp) * 1000),
          });
        }
      }
    }

    return updates;
  }

  private async uploadMedia(
    phoneNumberId: string,
    attachment: NonNullable<OutboundMessageInput['attachments']>[number],
    context: ChannelActionContext,
  ): Promise<string> {
    const form = new FormData();
    form.set('messaging_product', 'whatsapp');
    form.set('type', attachment.mimeType);
    form.set(
      'file',
      new Blob([new Uint8Array(attachment.buffer)], { type: attachment.mimeType }),
      attachment.fileName,
    );

    const response = await fetch(`${GRAPH_BASE_URL}/${phoneNumberId}/media`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${context.credential.apiKey ?? ''}` },
      body: form,
      signal: context.signal,
    });
    const body = (await response.json()) as WhatsAppMediaUploadResponse;
    if (!response.ok || !body.id) {
      throw new ChannelProviderError(
        `WhatsApp media upload failed: ${body.error?.message ?? response.statusText}`,
        'whatsapp_api_error',
      );
    }
    return body.id;
  }

  private async sendMediaMessage(
    phoneNumberId: string,
    to: string,
    mediaId: string,
    messageType: string,
    caption: string | undefined,
    context: ChannelActionContext,
  ): Promise<string> {
    const result = await requestJson<WhatsAppSendResponse>(
      `${GRAPH_BASE_URL}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: this.authHeaders(context),
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: messageType,
          [messageType]: { id: mediaId, ...(caption ? { caption } : {}) },
        }),
      },
      { signal: context.signal },
    );
    const messageId = result.body.messages?.[0]?.id;
    if (!messageId) {
      throw new ChannelProviderError(
        `WhatsApp media send failed: ${result.body.error?.message ?? 'no message id returned'}`,
        'whatsapp_api_error',
      );
    }
    return messageId;
  }

  private async downloadMedia(
    media: WhatsAppInboundMedia,
    context: ChannelActionContext,
  ): Promise<ParsedInboundAttachment | undefined> {
    try {
      const urlResult = await requestJson<WhatsAppMediaUrlResponse>(
        `${GRAPH_BASE_URL}/${media.id}`,
        { headers: this.authHeaders(context) },
        { signal: context.signal },
      );
      if (!urlResult.body.url) return undefined;

      const fileResponse = await fetch(urlResult.body.url, {
        headers: { Authorization: `Bearer ${context.credential.apiKey ?? ''}` },
        signal: context.signal,
      });
      if (!fileResponse.ok) return undefined;

      const buffer = Buffer.from(await fileResponse.arrayBuffer());
      const mimeType = media.mime_type ?? urlResult.body.mime_type ?? 'application/octet-stream';
      return { fileName: media.filename ?? media.id, mimeType, buffer };
    } catch {
      return undefined;
    }
  }

  private phoneNumberId(credential: CommsCredentialValue): string {
    const phoneNumberId = (credential.extra as { phoneNumberId?: string } | undefined)
      ?.phoneNumberId;
    if (!phoneNumberId) {
      throw new ChannelProviderError(
        'This WhatsApp connection is missing its phone number id',
        'missing_config',
      );
    }
    return phoneNumberId;
  }

  private authHeaders(context: ChannelActionContext): Record<string, string> {
    return {
      Authorization: `Bearer ${context.credential.apiKey ?? ''}`,
      'Content-Type': 'application/json',
    };
  }
}

function mimeToMessageType(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('video/')) return 'video';
  return 'document';
}
