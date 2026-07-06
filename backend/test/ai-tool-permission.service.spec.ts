import { ForbiddenException } from '@nestjs/common';
import {
  AiToolPermissionService,
  TOOL_PERMISSION_REQUIREMENTS,
} from '../src/modules/ai/gateway/ai-tool-permission.service';

describe('AiToolPermissionService', () => {
  const service = new AiToolPermissionService();
  const mutableRequirements = TOOL_PERMISSION_REQUIREMENTS as Record<string, string | null>;

  it('permits registered tools that require no permission regardless of granted permissions', () => {
    expect(() => service.assertPermitted('calculator', [])).not.toThrow();
    expect(() => service.assertPermitted('http_get', [])).not.toThrow();
  });

  it('permits an unregistered tool name to fall through to registry validation elsewhere', () => {
    expect(() => service.assertPermitted('unregistered_tool', [])).not.toThrow();
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
