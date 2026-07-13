/**
 * v2.3 Developer Platform (Phase 1) — @nestjs/swagger (v11) builds an
 * OpenAPI-3.0-shaped document even when `document.openapi` is force-set to
 * "3.1.0": every `@ApiPropertyOptional`/`nullable: true` decorator emits
 * the OpenAPI-3.0 `nullable` keyword, which OpenAPI 3.1 (built on full
 * JSON Schema 2020-12) does not recognize — a nullable string must instead
 * be `{"type": ["string", "null"]}`. Rather than touching the ~100+ DTO
 * files that use `nullable: true`, this walks the already-built document
 * once and rewrites every such node, so the label and the shape actually
 * agree.
 */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rewriteNullableNode(node: Record<string, unknown>): Record<string, unknown> {
  if (node.nullable !== true) {
    return node;
  }

  const { nullable: _nullable, ...rest } = node;

  if (typeof rest.type === 'string') {
    return { ...rest, type: [rest.type, 'null'] };
  }

  const type = rest.type;
  if (Array.isArray(type)) {
    const types = type as unknown[];
    return types.includes('null') ? rest : { ...rest, type: [...types, 'null'] };
  }

  // No `type` keyword to extend (e.g. a bare $ref, or allOf/oneOf/anyOf
  // composition) — OpenAPI 3.1's idiom for "this schema, or null" is an
  // anyOf with an explicit null branch.
  if (rest.$ref !== undefined || rest.allOf || rest.oneOf || rest.anyOf) {
    const { $ref, allOf, oneOf, anyOf, ...remaining } = rest;
    const inner = $ref !== undefined ? { $ref } : allOf ? { allOf } : oneOf ? { oneOf } : { anyOf };
    return { ...remaining, anyOf: [inner, { type: 'null' }] };
  }

  // No type information at all (schema is effectively "anything") —
  // nullable is already implied, nothing to rewrite.
  return rest;
}

function walk(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(walk);
  }
  if (isPlainObject(value)) {
    const rewritten = rewriteNullableNode(value);
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(rewritten)) {
      result[key] = walk(child);
    }
    return result;
  }
  return value;
}

/** Deep-transforms an OpenAPI document object into genuine 3.1-compliant shape. */
export function toOpenApi31<T extends object>(document: T): T {
  return walk(document) as T;
}
