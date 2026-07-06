import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { requestJson } from '../../provider/integration-http-client.util';
import { asString } from '../../provider/input-coercion.util';
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

const GRAPH_BASE_URL = 'https://graph.microsoft.com/v1.0/me/drive';

interface OneDriveItem {
  id: string;
  name: string;
  file?: { mimeType?: string };
  webUrl?: string;
  lastModifiedDateTime?: string;
}

interface OneDriveItemListResponse {
  value?: OneDriveItem[];
}

@Injectable()
export class MicrosoftOneDriveConnector implements IntegrationProvider {
  readonly key = 'MICROSOFT_ONEDRIVE' as const;
  readonly authType = 'OAUTH2' as const;
  readonly displayName = 'OneDrive';
  readonly supportsWebhooks = false;
  readonly supportsPolling = true;
  readonly oauthConfig;

  constructor(private readonly configService: ConfigService) {
    this.oauthConfig = microsoftOAuthConfig(configService, ['Files.ReadWrite']);
  }

  listActions(): IntegrationActionDescriptor[] {
    return [
      {
        name: 'upload_file',
        description: 'Upload a file to OneDrive.',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'File name.', required: true },
            content: { type: 'string', description: 'File content as plain text.', required: true },
          },
        },
      },
      {
        name: 'find_file',
        description: 'Find a OneDrive file by name.',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'File name to search for.', required: true },
          },
        },
      },
      {
        name: 'list_files',
        description: 'List recent OneDrive files.',
        inputSchema: { type: 'object', properties: {} },
      },
    ];
  }

  async executeAction(
    actionName: string,
    input: Record<string, unknown>,
    context: IntegrationActionContext,
  ): Promise<unknown> {
    switch (actionName) {
      case 'upload_file':
        return this.uploadFile(input, context);
      case 'find_file':
        return this.findFile(input, context);
      case 'list_files':
        return this.listFiles(context);
      default:
        throw new IntegrationProviderError(
          `Unknown OneDrive action "${actionName}"`,
          'unknown_action',
        );
    }
  }

  async checkHealth(context: IntegrationActionContext): Promise<IntegrationHealthResult> {
    const startedAt = Date.now();
    try {
      await requestJson(
        GRAPH_BASE_URL,
        { headers: this.authHeaders(context) },
        { signal: context.signal },
      );
      return { healthy: true, latencyMs: Date.now() - startedAt };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - startedAt,
        message: error instanceof Error ? error.message : 'OneDrive health check failed',
      };
    }
  }

  async poll(context: IntegrationActionContext): Promise<IntegrationPollResult> {
    const list = await requestJson<OneDriveItemListResponse>(
      `${GRAPH_BASE_URL}/root/children?$orderby=lastModifiedDateTime desc&$top=20`,
      { headers: this.authHeaders(context) },
      { signal: context.signal },
    );
    return {
      events: (list.body.value ?? []).map(toFileEvent),
      nextCursor: new Date().toISOString(),
    };
  }

  private async uploadFile(
    input: Record<string, unknown>,
    context: IntegrationActionContext,
  ): Promise<{ id: string; webUrl?: string }> {
    const name = asString(input.name, '');
    const content = asString(input.content, '');
    const result = await requestJson<{ id: string; webUrl?: string }>(
      `${GRAPH_BASE_URL}/root:/${encodeURIComponent(name)}:/content`,
      {
        method: 'PUT',
        headers: { ...this.authHeaders(context), 'Content-Type': 'text/plain' },
        body: content,
      },
      { signal: context.signal },
    );
    return { id: result.body.id, webUrl: result.body.webUrl };
  }

  private async findFile(
    input: Record<string, unknown>,
    context: IntegrationActionContext,
  ): Promise<{ id: string; name: string; webUrl?: string } | null> {
    const name = asString(input.name, '');
    const list = await requestJson<OneDriveItemListResponse>(
      `${GRAPH_BASE_URL}/root/search(q='${encodeURIComponent(name)}')`,
      { headers: this.authHeaders(context) },
      { signal: context.signal },
    );
    const file = list.body.value?.[0];
    return file ? { id: file.id, name: file.name, webUrl: file.webUrl } : null;
  }

  private async listFiles(
    context: IntegrationActionContext,
  ): Promise<{ files: Array<{ id: string; name: string }> }> {
    const list = await requestJson<OneDriveItemListResponse>(
      `${GRAPH_BASE_URL}/root/children`,
      { headers: this.authHeaders(context) },
      { signal: context.signal },
    );
    return { files: (list.body.value ?? []).map((item) => ({ id: item.id, name: item.name })) };
  }

  private authHeaders(context: IntegrationActionContext): Record<string, string> {
    return { Authorization: `Bearer ${context.credential.accessToken ?? ''}` };
  }
}

function toFileEvent(item: OneDriveItem): IntegrationParsedEvent {
  return {
    type: 'FILE_UPLOADED',
    externalId: item.id,
    occurredAt: item.lastModifiedDateTime ? new Date(item.lastModifiedDateTime) : undefined,
    payload: { id: item.id, name: item.name, mimeType: item.file?.mimeType, webUrl: item.webUrl },
    knowledgeContribution: {
      sourceType: 'UPLOADED_FILE',
      title: item.name,
      contentType: item.file?.mimeType ?? 'application/octet-stream',
      text: `File: ${item.name}`,
      metadata: { oneDriveItemId: item.id, webUrl: item.webUrl },
    },
  };
}
