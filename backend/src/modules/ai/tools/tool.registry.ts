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

@Injectable()
export class ToolRegistry {
  constructor(@Inject(AI_TOOLS) private readonly tools: AITool[]) {}

  list(): ToolDescriptor[] {
    return this.tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      defaultTimeoutMs: tool.defaultTimeoutMs,
      defaultRetries: tool.defaultRetries,
    }));
  }

  get(toolName: string): AITool {
    const tool = this.tools.find((item) => item.name === toolName);
    if (!tool) {
      throw new NotFoundException(`Tool "${toolName}" not found`);
    }

    return tool;
  }
}
