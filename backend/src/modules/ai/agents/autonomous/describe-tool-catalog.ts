import { ToolDescriptor } from '../../tools/tool.registry';

/**
 * Renders the tools an agent is allowed to use into a compact catalog for
 * prompting. An empty allow-list means "no restriction" (matches
 * AgentFactory.getAllowedToolNames's existing convention), so every
 * registered tool is included in that case.
 */
export function describeToolCatalog(
  allTools: ToolDescriptor[],
  allowedToolNames: string[],
): ToolDescriptor[] {
  return allowedToolNames.length > 0
    ? allTools.filter((tool) => allowedToolNames.includes(tool.name))
    : allTools;
}

export function renderToolCatalogForPrompt(tools: ToolDescriptor[]): string {
  if (tools.length === 0) {
    return '(no tools available)';
  }

  return tools
    .map((tool) => {
      const properties = Object.entries(tool.inputSchema.properties)
        .map(([key, schema]) => `${key}${schema.required ? '' : '?'}: ${schema.type}`)
        .join(', ');
      return `- ${tool.name}(${properties}): ${tool.description}`;
    })
    .join('\n');
}
