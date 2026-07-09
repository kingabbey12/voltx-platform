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

const DRIVE_BASE_URL = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_URL = 'https://www.googleapis.com/upload/drive/v3/files';

interface DriveFile {
  id: string;
  name: string;
  mimeType?: string;
  webViewLink?: string;
  modifiedTime?: string;
}

interface DriveFileListResponse {
  files?: DriveFile[];
}

@Injectable()
export class GoogleDriveConnector implements IntegrationProvider {
  readonly key = 'GOOGLE_DRIVE' as const;
  readonly authType = 'OAUTH2' as const;
  readonly displayName = 'Google Drive';
  readonly supportsWebhooks = false;
  readonly supportsPolling = true;
  readonly oauthConfig;

  constructor(private readonly configService: ConfigService) {
    this.oauthConfig = googleOAuthConfig(configService, [
      'https://www.googleapis.com/auth/drive',
      'https://www.googleapis.com/auth/userinfo.email',
    ]);
  }

  resolveAccountIdentity(credential: IntegrationCredentialValue): Promise<string | undefined> {
    return resolveGoogleAccountEmail(credential);
  }

  listActions(): IntegrationActionDescriptor[] {
    return [
      {
        name: 'upload_file',
        description: 'Upload a file to Google Drive.',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'File name.', required: true },
            mimeType: {
              type: 'string',
              description: 'MIME type, e.g. text/plain.',
              required: true,
            },
            content: { type: 'string', description: 'File content as plain text.', required: true },
          },
        },
      },
      {
        name: 'find_file',
        description: 'Find a Drive file by name.',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'File name to search for.', required: true },
          },
        },
      },
      {
        name: 'list_files',
        description: 'List recent Drive files, optionally filtered by a search query.',
        inputSchema: {
          type: 'object',
          properties: { query: { type: 'string', description: 'Optional Drive query string.' } },
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
      case 'upload_file':
        return this.uploadFile(input, context);
      case 'find_file':
        return this.findFile(input, context);
      case 'list_files':
        return this.listFiles(input, context);
      default:
        throw new IntegrationProviderError(
          `Unknown Drive action "${actionName}"`,
          'unknown_action',
        );
    }
  }

  async checkHealth(context: IntegrationActionContext): Promise<IntegrationHealthResult> {
    const startedAt = Date.now();
    try {
      await requestJson(
        `${DRIVE_BASE_URL}/about?fields=user`,
        { headers: this.authHeaders(context) },
        { signal: context.signal },
      );
      return { healthy: true, latencyMs: Date.now() - startedAt };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - startedAt,
        message: error instanceof Error ? error.message : 'Drive health check failed',
      };
    }
  }

  async poll(context: IntegrationActionContext, cursor?: string): Promise<IntegrationPollResult> {
    const modifiedSince = cursor ?? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const list = await requestJson<DriveFileListResponse>(
      `${DRIVE_BASE_URL}/files?q=${encodeURIComponent(`modifiedTime > '${modifiedSince}'`)}&fields=files(id,name,mimeType,webViewLink,modifiedTime)`,
      { headers: this.authHeaders(context) },
      { signal: context.signal },
    );
    return {
      events: (list.body.files ?? []).map(toFileEvent),
      nextCursor: new Date().toISOString(),
    };
  }

  private async uploadFile(
    input: Record<string, unknown>,
    context: IntegrationActionContext,
  ): Promise<{ id: string; webViewLink?: string }> {
    const name = asString(input.name, '');
    const mimeType = asString(input.mimeType, 'text/plain');
    const content = asString(input.content, '');
    const boundary = 'voltx-drive-upload-boundary';
    const multipartBody =
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify({ name, mimeType })}\r\n` +
      `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n${content}\r\n--${boundary}--`;

    const result = await requestJson<{ id: string; webViewLink?: string }>(
      `${DRIVE_UPLOAD_URL}?uploadType=multipart&fields=id,webViewLink`,
      {
        method: 'POST',
        headers: {
          ...this.authHeaders(context),
          'Content-Type': `multipart/related; boundary=${boundary}`,
        },
        body: multipartBody,
      },
      { signal: context.signal },
    );
    return { id: result.body.id, webViewLink: result.body.webViewLink };
  }

  private async findFile(
    input: Record<string, unknown>,
    context: IntegrationActionContext,
  ): Promise<{ id: string; name: string; webViewLink?: string } | null> {
    const name = asString(input.name, '');
    const list = await requestJson<DriveFileListResponse>(
      `${DRIVE_BASE_URL}/files?q=${encodeURIComponent(`name = '${name.replace(/'/gu, "\\'")}'`)}&fields=files(id,name,webViewLink)`,
      { headers: this.authHeaders(context) },
      { signal: context.signal },
    );
    const file = list.body.files?.[0];
    return file ? { id: file.id, name: file.name, webViewLink: file.webViewLink } : null;
  }

  private async listFiles(
    input: Record<string, unknown>,
    context: IntegrationActionContext,
  ): Promise<{ files: Array<{ id: string; name: string }> }> {
    const query = asOptionalString(input.query);
    const list = await requestJson<DriveFileListResponse>(
      `${DRIVE_BASE_URL}/files${query ? `?q=${encodeURIComponent(query)}` : ''}`,
      { headers: this.authHeaders(context) },
      { signal: context.signal },
    );
    return { files: (list.body.files ?? []).map((file) => ({ id: file.id, name: file.name })) };
  }

  private authHeaders(context: IntegrationActionContext): Record<string, string> {
    return { Authorization: `Bearer ${context.credential.accessToken ?? ''}` };
  }
}

function toFileEvent(file: DriveFile): IntegrationParsedEvent {
  return {
    type: 'FILE_UPLOADED',
    externalId: file.id,
    occurredAt: file.modifiedTime ? new Date(file.modifiedTime) : undefined,
    payload: {
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      webViewLink: file.webViewLink,
    },
    knowledgeContribution: {
      sourceType: 'UPLOADED_FILE',
      title: file.name,
      contentType: file.mimeType ?? 'application/octet-stream',
      text: `File: ${file.name}`,
      metadata: { googleDriveFileId: file.id, webViewLink: file.webViewLink },
    },
  };
}
