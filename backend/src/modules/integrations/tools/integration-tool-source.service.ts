import { Injectable, OnModuleInit } from '@nestjs/common';
import { AITool, ToolExecutionContext, ToolSchema } from '../../ai/tools/tool.interface';
import { DynamicToolSource, ToolRegistry } from '../../ai/tools/tool.registry';
import { IntegrationDispatcherService } from '../dispatch/integration-dispatcher.service';
import { IntegrationProviderRegistry } from '../provider/integration-provider.registry';
import {
  IntegrationActionDescriptor,
  IntegrationProviderKey,
} from '../provider/integration-provider.types';

function toToolName(provider: IntegrationProviderKey, actionName: string): string {
  return `integration_${provider.toLowerCase()}_${actionName}`;
}

function toToolSchema(action: IntegrationActionDescriptor): ToolSchema {
  return { type: 'object', properties: action.inputSchema.properties };
}

/**
 * Makes every connector action an AI Tool automatically (VT-025's "AI
 * Integration" requirement) by generating one AITool wrapper per
 * (provider, action) pair from IntegrationProviderRegistry — no
 * per-connector tool classes to hand-write or keep in sync. Registers
 * itself as a DynamicToolSource with ToolRegistry (see that class's
 * registerDynamicSource docstring) since the static AI_TOOLS DI token
 * can't be extended across module boundaries.
 */
@Injectable()
export class IntegrationToolSourceService implements DynamicToolSource, OnModuleInit {
  constructor(
    private readonly toolRegistry: ToolRegistry,
    private readonly integrationProviderRegistry: IntegrationProviderRegistry,
    private readonly integrationDispatcherService: IntegrationDispatcherService,
  ) {}

  onModuleInit(): void {
    this.toolRegistry.registerDynamicSource(this);
  }

  listTools(): AITool[] {
    return this.integrationProviderRegistry
      .list()
      .flatMap((provider) =>
        provider
          .listActions()
          .map((action) => this.buildTool(provider.key, provider.displayName, action)),
      );
  }

  private buildTool(
    provider: IntegrationProviderKey,
    providerDisplayName: string,
    action: IntegrationActionDescriptor,
  ): AITool {
    const dispatcher = this.integrationDispatcherService;
    return {
      name: toToolName(provider, action.name),
      description: `[${providerDisplayName}] ${action.description}`,
      inputSchema: toToolSchema(action),
      defaultTimeoutMs: 15_000,
      defaultRetries: 1,
      requiredPermission: action.mutates === false ? 'integration.read' : 'integration.create',
      execute(input: Record<string, unknown>, context: ToolExecutionContext): Promise<unknown> {
        return dispatcher.execute({
          provider,
          actionName: action.name,
          input,
          connectionId: typeof input.connectionId === 'string' ? input.connectionId : undefined,
          signal: context.signal,
        });
      },
      // Connector outputs are provider-shaped and untyped here, so the
      // grounding is honestly generic: what ran, and whether it acted.
      // No records are claimed — a claim without a canonical id is not made.
      ground() {
        return {
          summary:
            action.mutates === false
              ? `Read from ${providerDisplayName} (${action.name})`
              : `Acted through ${providerDisplayName} (${action.name})`,
          records: [],
          events:
            action.mutates === false
              ? []
              : [{ description: `${providerDisplayName}: ${action.name} executed` }],
        };
      },
    };
  }
}
