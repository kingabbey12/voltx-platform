import { JsonSchemaLite } from './json-schema-lite.util';

/**
 * The entire security boundary for Custom Pages/Widgets — a fixed,
 * versioned component palette that `manifest-renderer.tsx` (web) knows
 * how to render. A developer's manifest can only ever reference these
 * names; adding a new one here is equivalent to shipping a new
 * first-party page component and needs the same review as one.
 */
export const ALLOWED_COMPONENT_TYPES = [
  'section',
  'table',
  'stat-card',
  'form',
  'text',
  'list',
  'chart',
  'button',
] as const;
export type AllowedComponentType = (typeof ALLOWED_COMPONENT_TYPES)[number];

export const ALLOWED_WIDGET_PLACEMENTS = ['DASHBOARD', 'CRM_SIDEBAR'] as const;

export interface ManifestDataSource {
  method: 'GET' | 'POST';
  path: string;
}

export interface ManifestComponentNode {
  type: string;
  props?: Record<string, unknown>;
  dataSource?: ManifestDataSource;
  children?: ManifestComponentNode[];
}

export interface ManifestPage {
  path: string;
  title: string;
  root: ManifestComponentNode;
}

export interface ManifestWidget {
  placement: string;
  root: ManifestComponentNode;
}

export interface ManifestNavEntry {
  label: string;
  icon?: string;
  targetPath: string;
}

export interface ManifestAiTool {
  name: string;
  description: string;
  parametersSchema: JsonSchemaLite;
  responseSchema: JsonSchemaLite;
  endpointUrl: string;
}

export interface ExtensionManifest {
  pages?: ManifestPage[];
  widgets?: ManifestWidget[];
  navEntries?: ManifestNavEntry[];
  aiTools?: ManifestAiTool[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateComponentNode(node: unknown, path: string, errors: string[]): void {
  if (!isRecord(node)) {
    errors.push(`${path}: must be an object`);
    return;
  }

  if (
    typeof node.type !== 'string' ||
    !ALLOWED_COMPONENT_TYPES.includes(node.type as AllowedComponentType)
  ) {
    errors.push(`${path}.type: must be one of ${ALLOWED_COMPONENT_TYPES.join(', ')}`);
  }

  if (node.props !== undefined && !isRecord(node.props)) {
    errors.push(`${path}.props: must be an object`);
  }

  if (node.dataSource !== undefined) {
    if (!isRecord(node.dataSource)) {
      errors.push(`${path}.dataSource: must be an object`);
    } else {
      if (node.dataSource.method !== 'GET' && node.dataSource.method !== 'POST') {
        errors.push(`${path}.dataSource.method: must be GET or POST`);
      }
      if (typeof node.dataSource.path !== 'string' || !node.dataSource.path.startsWith('/')) {
        errors.push(
          `${path}.dataSource.path: must be a relative API path starting with "/" — executed under the installing organization's own authenticated session, never an external URL`,
        );
      }
    }
  }

  if (node.children !== undefined) {
    if (!Array.isArray(node.children)) {
      errors.push(`${path}.children: must be an array`);
    } else {
      node.children.forEach((child, index) =>
        validateComponentNode(child, `${path}.children[${index}]`, errors),
      );
    }
  }
}

function isValidHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Validates a submitted app version's manifest at submission time (see
 * MarketplaceAppService.createVersion) — a malformed manifest is
 * rejected immediately with a BadRequestException rather than being
 * accepted and only failing later at approval/materialization time.
 * Returns the list of validation errors; empty means valid.
 */
export function validateExtensionManifest(manifest: unknown): string[] {
  const errors: string[] = [];

  if (!isRecord(manifest)) {
    return ['manifest must be an object'];
  }

  const { pages, widgets, navEntries, aiTools } = manifest as ExtensionManifest;

  const pagePaths = new Set<string>();
  if (pages !== undefined) {
    if (!Array.isArray(pages)) {
      errors.push('pages: must be an array');
    } else {
      pages.forEach((page, index) => {
        const prefix = `pages[${index}]`;
        if (!isRecord(page)) {
          errors.push(`${prefix}: must be an object`);
          return;
        }
        if (typeof page.path !== 'string' || !page.path.startsWith('/')) {
          errors.push(`${prefix}.path: must be a string starting with "/"`);
        } else if (pagePaths.has(page.path)) {
          errors.push(`${prefix}.path: duplicate page path "${page.path}"`);
        } else {
          pagePaths.add(page.path);
        }
        if (typeof page.title !== 'string' || page.title.length === 0) {
          errors.push(`${prefix}.title: must be a non-empty string`);
        }
        validateComponentNode(page.root, `${prefix}.root`, errors);
      });
    }
  }

  if (widgets !== undefined) {
    if (!Array.isArray(widgets)) {
      errors.push('widgets: must be an array');
    } else {
      widgets.forEach((widget, index) => {
        const prefix = `widgets[${index}]`;
        if (!isRecord(widget)) {
          errors.push(`${prefix}: must be an object`);
          return;
        }
        if (
          typeof widget.placement !== 'string' ||
          !ALLOWED_WIDGET_PLACEMENTS.includes(
            widget.placement as (typeof ALLOWED_WIDGET_PLACEMENTS)[number],
          )
        ) {
          errors.push(
            `${prefix}.placement: must be one of ${ALLOWED_WIDGET_PLACEMENTS.join(', ')}`,
          );
        }
        validateComponentNode(widget.root, `${prefix}.root`, errors);
      });
    }
  }

  if (navEntries !== undefined) {
    if (!Array.isArray(navEntries)) {
      errors.push('navEntries: must be an array');
    } else {
      navEntries.forEach((entry, index) => {
        const prefix = `navEntries[${index}]`;
        if (!isRecord(entry)) {
          errors.push(`${prefix}: must be an object`);
          return;
        }
        if (typeof entry.label !== 'string' || entry.label.length === 0) {
          errors.push(`${prefix}.label: must be a non-empty string`);
        }
        if (typeof entry.targetPath !== 'string' || !pagePaths.has(entry.targetPath)) {
          errors.push(`${prefix}.targetPath: must reference a path declared in "pages"`);
        }
      });
    }
  }

  if (aiTools !== undefined) {
    if (!Array.isArray(aiTools)) {
      errors.push('aiTools: must be an array');
    } else {
      const names = new Set<string>();
      aiTools.forEach((tool, index) => {
        const prefix = `aiTools[${index}]`;
        if (!isRecord(tool)) {
          errors.push(`${prefix}: must be an object`);
          return;
        }
        if (typeof tool.name !== 'string' || !/^[a-z][a-z0-9_]*$/.test(tool.name)) {
          errors.push(`${prefix}.name: must be a lowercase snake_case identifier`);
        } else if (names.has(tool.name)) {
          errors.push(`${prefix}.name: duplicate tool name "${tool.name}"`);
        } else {
          names.add(tool.name);
        }
        if (typeof tool.description !== 'string' || tool.description.length === 0) {
          errors.push(`${prefix}.description: must be a non-empty string`);
        }
        if (!isRecord(tool.parametersSchema)) {
          errors.push(`${prefix}.parametersSchema: must be a JSON Schema object`);
        }
        if (!isRecord(tool.responseSchema)) {
          errors.push(`${prefix}.responseSchema: must be a JSON Schema object`);
        }
        if (typeof tool.endpointUrl !== 'string' || !isValidHttpsUrl(tool.endpointUrl)) {
          errors.push(`${prefix}.endpointUrl: must be a valid https:// URL`);
        }
      });
    }
  }

  return errors;
}
