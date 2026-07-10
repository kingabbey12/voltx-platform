import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  AiToolPermissionService,
  TOOL_PERMISSION_REQUIREMENTS,
} from '../src/modules/ai/gateway/ai-tool-permission.service';
import { AITool } from '../src/modules/ai/tools/tool.interface';
import { ToolRegistry } from '../src/modules/ai/tools/tool.registry';

describe('AiToolPermissionService', () => {
  const registeredTools = new Map<string, AITool>();
  const toolRegistry = {
    get: (name: string) => {
      const tool = registeredTools.get(name);
      if (!tool) throw new NotFoundException(`Tool "${name}" not found`);
      return tool;
    },
  } as unknown as ToolRegistry;
  const service = new AiToolPermissionService(toolRegistry);
  const mutableRequirements = TOOL_PERMISSION_REQUIREMENTS as Record<string, string | null>;

  afterEach(() => {
    registeredTools.clear();
  });

  it('permits registered tools that require no permission regardless of granted permissions', () => {
    expect(() => service.assertPermitted('calculator', [])).not.toThrow();
    expect(() => service.assertPermitted('http_get', [])).not.toThrow();
  });

  it('permits an unregistered tool name to fall through to registry validation elsewhere', () => {
    expect(() => service.assertPermitted('unregistered_tool', [])).not.toThrow();
  });

  describe('when a dynamically-generated tool declares its own requiredPermission', () => {
    const toolName = 'integration_google_calendar_create_event';

    beforeEach(() => {
      registeredTools.set(toolName, {
        name: toolName,
        description: 'test',
        inputSchema: { type: 'object', properties: {} },
        requiredPermission: 'integration.create',
        execute: () => Promise.resolve(undefined),
      });
    });

    it('rejects when the granted permissions lack the tool-declared requirement', () => {
      expect(() => service.assertPermitted(toolName, ['integration.read'])).toThrow(
        ForbiddenException,
      );
    });

    it('allows when the granted permissions include the tool-declared requirement', () => {
      expect(() => service.assertPermitted(toolName, ['integration.create'])).not.toThrow();
    });
  });

  describe('when a tool declares a required permission', () => {
    const toolName = '__test_restricted_tool__';

    beforeEach(() => {
      mutableRequirements[toolName] = 'sales.opportunity.read';
    });

    afterEach(() => {
      delete mutableRequirements[toolName];
    });

    it('rejects the call when the permission is not granted', () => {
      expect(() => service.assertPermitted(toolName, ['sales.company.read'])).toThrow(
        ForbiddenException,
      );
    });

    it('allows the call when the required permission is granted', () => {
      expect(() => service.assertPermitted(toolName, ['sales.opportunity.read'])).not.toThrow();
    });
  });
});
