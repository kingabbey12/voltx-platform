import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { EncryptionService } from '../../security/encryption.service';
import { requestJson } from '../../provider/integration-http-client.util';
import { asString, asOptionalString } from '../../provider/input-coercion.util';
import { githubOAuthConfig } from '../../provider/oauth-provider-configs';
import {
  IntegrationActionContext,
  IntegrationActionDescriptor,
  IntegrationHealthResult,
  IntegrationParsedEvent,
  IntegrationProvider,
  IntegrationProviderError,
} from '../../provider/integration-provider.types';

const GITHUB_API_BASE_URL = 'https://api.github.com';

interface GitHubIssue {
  number: number;
  title: string;
  html_url: string;
  body?: string;
  state?: string;
}

@Injectable()
export class GitHubConnector implements IntegrationProvider {
  readonly key = 'GITHUB' as const;
  readonly authType = 'OAUTH2' as const;
  readonly displayName = 'GitHub';
  readonly supportsWebhooks = true;
  readonly supportsPolling = false;
  readonly oauthConfig;

  constructor(private readonly configService: ConfigService) {
    this.oauthConfig = githubOAuthConfig(configService, ['repo']);
  }

  listActions(): IntegrationActionDescriptor[] {
    return [
      {
        name: 'create_issue',
        description: 'Create a GitHub issue in a repository.',
        inputSchema: {
          type: 'object',
          properties: {
            repo: { type: 'string', description: 'Repository as "owner/name".', required: true },
            title: { type: 'string', description: 'Issue title.', required: true },
            body: { type: 'string', description: 'Issue body.' },
          },
        },
      },
      {
        name: 'list_issues',
        description: 'List open issues in a repository.',
        inputSchema: {
          type: 'object',
          properties: {
            repo: { type: 'string', description: 'Repository as "owner/name".', required: true },
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
      case 'create_issue':
        return this.createIssue(input, context);
      case 'list_issues':
        return this.listIssues(input, context);
      default:
        throw new IntegrationProviderError(
          `Unknown GitHub action "${actionName}"`,
          'unknown_action',
        );
    }
  }

  async checkHealth(context: IntegrationActionContext): Promise<IntegrationHealthResult> {
    const startedAt = Date.now();
    try {
      await requestJson(
        `${GITHUB_API_BASE_URL}/user`,
        { headers: this.authHeaders(context) },
        { signal: context.signal },
      );
      return { healthy: true, latencyMs: Date.now() - startedAt };
    } catch (error) {
      return {
        healthy: false,
        latencyMs: Date.now() - startedAt,
        message: error instanceof Error ? error.message : 'GitHub health check failed',
      };
    }
  }

  /** GitHub's webhook scheme: `X-Hub-Signature-256: sha256=<hmac>` over the raw request body. */
  verifyWebhookSignature(
    headers: Record<string, string>,
    rawBody: string,
    secret: string,
  ): boolean {
    const signatureHeader = headers['x-hub-signature-256'];
    if (!signatureHeader?.startsWith('sha256=')) {
      return false;
    }
    const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
    return EncryptionService.safeEqual(expected, signatureHeader);
  }

  parseWebhookPayload(headers: Record<string, string>, rawBody: string): IntegrationParsedEvent[] {
    const eventName = headers['x-github-event'];
    if (eventName !== 'issues') {
      return [];
    }

    const body = JSON.parse(rawBody) as {
      action?: string;
      issue?: GitHubIssue;
      repository?: { full_name?: string };
    };
    if (!body.issue) {
      return [];
    }

    const issue = body.issue;
    return [
      {
        type: 'GITHUB_ISSUE',
        externalId: String(issue.number),
        payload: {
          action: body.action,
          number: issue.number,
          title: issue.title,
          url: issue.html_url,
        },
        knowledgeContribution: {
          sourceType: 'ISSUE',
          title: issue.title,
          contentType: 'text',
          text: `Issue #${issue.number}: ${issue.title}\n\n${issue.body ?? ''}`,
          metadata: {
            repo: body.repository?.full_name,
            issueNumber: issue.number,
            url: issue.html_url,
          },
        },
      },
    ];
  }

  private async createIssue(
    input: Record<string, unknown>,
    context: IntegrationActionContext,
  ): Promise<{ number: number; url: string }> {
    const repo = asString(input.repo, '');
    const result = await requestJson<GitHubIssue>(
      `${GITHUB_API_BASE_URL}/repos/${repo}/issues`,
      {
        method: 'POST',
        headers: { ...this.authHeaders(context), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: asString(input.title, ''),
          body: asOptionalString(input.body),
        }),
      },
      { signal: context.signal },
    );
    return { number: result.body.number, url: result.body.html_url };
  }

  private async listIssues(
    input: Record<string, unknown>,
    context: IntegrationActionContext,
  ): Promise<{ issues: Array<{ number: number; title: string; url: string }> }> {
    const repo = asString(input.repo, '');
    const result = await requestJson<GitHubIssue[]>(
      `${GITHUB_API_BASE_URL}/repos/${repo}/issues?state=open`,
      { headers: this.authHeaders(context) },
      { signal: context.signal },
    );
    return {
      issues: result.body.map((issue) => ({
        number: issue.number,
        title: issue.title,
        url: issue.html_url,
      })),
    };
  }

  private authHeaders(context: IntegrationActionContext): Record<string, string> {
    return {
      Authorization: `Bearer ${context.credential.accessToken ?? ''}`,
      Accept: 'application/vnd.github+json',
    };
  }
}
