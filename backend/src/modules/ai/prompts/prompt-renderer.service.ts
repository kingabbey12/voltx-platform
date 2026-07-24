import { BadRequestException, Injectable } from '@nestjs/common';

/**
 * The built-in variables every prompt may reference. `today` is always
 * auto-filled; `user`/`organization` are auto-filled from tenant context when
 * available; the rest are supplied by the caller. Custom variable names beyond
 * this set are allowed.
 */
export const BUILTIN_VARIABLES = [
  'customer_name',
  'company_name',
  'today',
  'language',
  'context',
  'documents',
  'user',
  'organization',
] as const;

/** Auto-resolved variables — never required from the caller. */
export const AUTO_VARIABLES = ['today', 'user', 'organization'] as const;

const TOKEN = /\{\{\s*([^}]*?)\s*\}\}/g;
const VALID_NAME = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export interface TemplateValidationResult {
  valid: boolean;
  errors: string[];
  /** Distinct variable names the template references. */
  referenced: string[];
}

/**
 * Renders `{{variable}}` templates by pure string substitution — never eval,
 * `Function`, or any template engine that could execute code from a stored
 * prompt. Also validates templates (syntax, duplicate declarations, and
 * missing variables) for the management layer.
 */
@Injectable()
export class PromptRendererService {
  /** Distinct, syntactically valid variable names referenced by the template. */
  extractReferences(template: string): string[] {
    const names = new Set<string>();
    for (const match of template.matchAll(TOKEN)) {
      const name = match[1].trim();
      if (VALID_NAME.test(name)) {
        names.add(name);
      }
    }
    return [...names];
  }

  /**
   * Validates a template against its declared variable list. Reports invalid
   * `{{ }}` syntax, duplicate declarations, declared-but-unused names, and
   * referenced variables that are neither declared nor built-in (missing).
   */
  validate(template: string, declaredVariables: string[]): TemplateValidationResult {
    const errors: string[] = [];

    // Duplicate declarations.
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const name of declaredVariables) {
      if (seen.has(name)) {
        duplicates.add(name);
      }
      seen.add(name);
      if (!VALID_NAME.test(name)) {
        errors.push(`Declared variable "${name}" is not a valid identifier.`);
      }
    }
    for (const dup of duplicates) {
      errors.push(`Duplicate variable declaration: "${dup}".`);
    }

    // Syntax: every {{ ... }} must contain exactly one valid identifier.
    for (const match of template.matchAll(TOKEN)) {
      const inner = match[1].trim();
      if (inner.length === 0) {
        errors.push('Empty variable placeholder "{{}}".');
      } else if (!VALID_NAME.test(inner)) {
        errors.push(`Invalid variable syntax: "{{${match[1]}}}".`);
      }
    }
    // Unbalanced braces (a stray "{{" or "}}" with no match).
    const opens = (template.match(/\{\{/g) ?? []).length;
    const closes = (template.match(/\}\}/g) ?? []).length;
    if (opens !== closes) {
      errors.push('Unbalanced "{{" / "}}" in template.');
    }

    const referenced = this.extractReferences(template);
    const known = new Set<string>([...declaredVariables, ...BUILTIN_VARIABLES]);

    // Missing: referenced but neither declared nor built-in.
    for (const name of referenced) {
      if (!known.has(name)) {
        errors.push(`Variable "${name}" is referenced but not declared.`);
      }
    }
    // Declared but unused (surfaced as a soft error to keep declarations honest).
    for (const name of declaredVariables) {
      if (!referenced.includes(name)) {
        errors.push(`Declared variable "${name}" is not used in the template.`);
      }
    }

    return { valid: errors.length === 0, errors, referenced };
  }

  /**
   * Renders the template, substituting each `{{name}}` with `values[name]`.
   * Throws when a referenced variable has no value (missing) or the template
   * has invalid placeholder syntax — so no unresolved `{{...}}` ever reaches a
   * provider.
   */
  render(template: string, values: Record<string, string>): string {
    const missing = new Set<string>();
    const invalid = new Set<string>();

    const rendered = template.replace(TOKEN, (_full, rawName: string) => {
      const name = rawName.trim();
      if (!VALID_NAME.test(name)) {
        invalid.add(name.length === 0 ? '(empty)' : name);
        return '';
      }
      if (!(name in values)) {
        missing.add(name);
        return '';
      }
      return values[name];
    });

    if (invalid.size > 0) {
      throw new BadRequestException(
        `Invalid variable syntax: ${[...invalid].map((n) => `"${n}"`).join(', ')}.`,
      );
    }
    if (missing.size > 0) {
      throw new BadRequestException(
        `Missing values for variables: ${[...missing].map((n) => `"${n}"`).join(', ')}.`,
      );
    }
    return rendered;
  }
}
