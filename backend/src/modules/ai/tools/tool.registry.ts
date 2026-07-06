import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AI_TOOLS, AITool } from './tool.interface';

export interface ToolDescriptor {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<
      string,
      {
        type: 'string' | 'number' | 'boolean' | 'object' | 'array';
        description: string;
        required?: boolean;
      }
    >;
  };
  defaultTimeoutMs?: number;
  defaultRetries?: number;
}

/** A source of AITools contributed by another module, registered dynamically rather than through the static AI_TOOLS DI token. */
export interface DynamicToolSource {
  listTools(): AITool[];
}

@Injectable()
export class ToolRegistry {
  private readonly dynamicSources: DynamicToolSource[] = [];

  constructor(@Inject(AI_TOOLS) private readonly tools: AITool[]) {}

  /**
   * Extension point for tools owned by other modules (e.g. the
   * integrations module registering one AITool per connector action) —
   * those modules depend on AIModule/ToolModule to reach this registry,
   * never the other way around, so no circular module dependency is
   * introduced. NestJS has no built-in multi-provider merging for a
   * single DI token, so this registration hook is what makes the tool
   * catalog extensible across modules at all.
   */
  registerDynamicSource(source: DynamicToolSource): void {
    this.dynamicSources.push(source);
  }

  private allTools(): AITool[] {
    return [...this.tools, ...this.dynamicSources.flatMap((source) => source.listTools())];
  }

  list(): ToolDescriptor[] {
    return this.allTools().map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      defaultTimeoutMs: tool.defaultTimeoutMs,
      defaultRetries: tool.defaultRetries,
    }));
  }

  get(toolName: string): AITool {
    const tool = this.allTools().find((item) => item.name === toolName);
    if (!tool) {
      throw new NotFoundException(`Tool "${toolName}" not found`);
    }

    return tool;
  }
}
