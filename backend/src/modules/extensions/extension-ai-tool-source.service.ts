import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TenantContextService } from '../../common/tenant/tenant-context.service';
import { signWebhookPayload } from '../../common/utils/hmac.util';
import {
  AITool,
  ToolExecutionContext,
  ToolExecutionError,
  ToolSchema,
} from '../ai/tools/tool.interface';
import { DynamicToolSource, ToolRegistry } from '../ai/tools/tool.registry';
import { OutboundHttpGuardService } from '../ai/tools/outbound-http-guard.service';
import { EncryptionService } from '../integrations/security/encryption.service';
import { ExtensionAiToolEntity } from './entities/extension.entity';
import { ExtensionRepository } from './extension.repository';
import { JsonSchemaLite, validateAgainstJsonSchema } from './utils/json-schema-lite.util';

const CACHE_TTL_MS = 30_000;

function toToolName(appId: string, toolName: string): string {
  return `extension_${appId.replace(/-/g, '')}_${toolName}`;
}

function toToolSchema(schema: JsonSchemaLite): ToolSchema {
  const required = new Set(schema.required ?? []);
  const properties: ToolSchema['properties'] = {};

  for (const [key, subSchema] of Object.entries(schema.properties ?? {})) {
    properties[key] = {
      type: subSchema.type === 'integer' ? 'number' : (subSchema.type ?? 'string'),
      description: '',
      required: required.has(key),
    };
  }

  return { type: 'object', properties };
}

/**
 * Custom AI Tools (v2.3 Developer Platform, Phase 8) — every
 * ExtensionAiTool row materialized from an approved app version becomes
 * one AITool, but only for organizations that actually have that app
 * actively installed. `DynamicToolSource.listTools()` is synchronous
 * (ToolRegistry composes every source's tools inline, on every request),
 * while "which apps does this org have installed" is a DB read — so
 * results are cached per organization with a short TTL rather than
 * making the shared ToolRegistry/DynamicToolSource contract async for
 * every existing dynamic source. A stale cache means at most
 * CACHE_TTL_MS of delay between installing an app and its AI tool
 * becoming callable — an acceptable, bounded trade-off for a feature
 * nobody expects to propagate instantly, and it avoids a new
 * cross-module dependency from Marketplace's install/uninstall flow back
 * into this one.
 *
 * Invocation is an HMAC-signed HTTPS call to the developer's own
 * endpoint — identical threat model and signing scheme to an outbound
 * webhook delivery (SSRF-guarded via OutboundHttpGuardService, signed via
 * the same hmac.util.ts WebhookDeliveryService uses). The response is
 * validated against the tool's own declared `responseSchema` before ever
 * reaching the AI runtime, so a malformed or unexpected developer
 * response never gets handed to the model as fact.
 */
@Injectable()
export class ExtensionAiToolSourceService implements DynamicToolSource, OnModuleInit {
  private readonly logger = new Logger(ExtensionAiToolSourceService.name);
  private readonly cache = new Map<string, { tools: AITool[]; expiresAt: number }>();
  private readonly inFlightRefreshes = new Set<string>();

  constructor(
    private readonly toolRegistry: ToolRegistry,
    private readonly extensionRepository: ExtensionRepository,
    private readonly tenantContextService: TenantContextService,
    private readonly outboundHttpGuard: OutboundHttpGuardService,
    private readonly encryptionService: EncryptionService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    this.toolRegistry.registerDynamicSource(this);
  }

  listTools(): AITool[] {
    const organizationId = this.tenantContextService.get()?.organizationId;
    if (!organizationId) {
      return [];
    }

    const cached = this.cache.get(organizationId);
    if (!cached || cached.expiresAt <= Date.now()) {
      this.triggerBackgroundRefresh(organizationId);
    }

    return cached?.tools ?? [];
  }

  private triggerBackgroundRefresh(organizationId: string): void {
    if (this.inFlightRefreshes.has(organizationId)) {
      return;
    }
    this.inFlightRefreshes.add(organizationId);

    this.refreshOrganization(organizationId)
      .catch((error: unknown) => {
        this.logger.warn(
          { organizationId, error },
          'Failed to refresh installed extension AI tools for organization',
        );
      })
      .finally(() => {
        this.inFlightRefreshes.delete(organizationId);
      });
  }

  private async refreshOrganization(organizationId: string): Promise<void> {
    const installed =
      await this.extensionRepository.listActiveAiToolsForOrganization(organizationId);
    const tools = installed.map(({ appId, tool }) => this.buildTool(appId, tool));
    this.cache.set(organizationId, { tools, expiresAt: Date.now() + CACHE_TTL_MS });
  }

  private buildTool(appId: string, tool: ExtensionAiToolEntity): AITool {
    const outboundHttpGuard = this.outboundHttpGuard;
    const encryptionService = this.encryptionService;
    const configService = this.configService;
    const parametersSchema = tool.parametersSchema as unknown as JsonSchemaLite;
    const responseSchema = tool.responseSchema as unknown as JsonSchemaLite;

    return {
      name: toToolName(appId, tool.name),
      description: tool.description,
      inputSchema: toToolSchema(parametersSchema),
      defaultTimeoutMs: 15_000,
      defaultRetries: 0,
      async execute(
        input: Record<string, unknown>,
        _context: ToolExecutionContext,
      ): Promise<unknown> {
        const secret = encryptionService.decrypt(tool.encryptedSigningSecret);
        const rawBody = JSON.stringify({ tool: tool.name, input });
        const signature = signWebhookPayload(secret, rawBody);
        const timeoutMs = configService.get<number>('webhooks.requestTimeoutMs', 10000);

        const response = await outboundHttpGuard.fetch(
          tool.endpointUrl,
          toToolName(appId, tool.name),
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Voltx-Signature': signature,
            },
            body: rawBody,
            signal: AbortSignal.timeout(timeoutMs),
          },
        );

        if (!response.ok) {
          throw new ToolExecutionError(
            `Custom AI Tool "${tool.name}" endpoint returned ${response.status}`,
            'extension_ai_tool_http_error',
            response.status >= 500,
          );
        }

        let parsed: unknown;
        try {
          parsed = await response.json();
        } catch {
          throw new ToolExecutionError(
            `Custom AI Tool "${tool.name}" endpoint did not return valid JSON`,
            'extension_ai_tool_invalid_response',
          );
        }

        const errors = validateAgainstJsonSchema(parsed, responseSchema);
        if (errors.length > 0) {
          throw new ToolExecutionError(
            `Custom AI Tool "${tool.name}" response did not match its declared schema: ${errors.join('; ')}`,
            'extension_ai_tool_schema_mismatch',
          );
        }

        return parsed;
      },
      // Extension endpoints are third-party code with declared-but-untyped
      // response schemas; the grounding is honestly generic and claims no
      // canonical records.
      ground() {
        return {
          summary: `Ran the custom tool ${tool.name}`,
          records: [],
          events: [{ description: `Custom tool ${tool.name} executed` }],
        };
      },
    };
  }
}
