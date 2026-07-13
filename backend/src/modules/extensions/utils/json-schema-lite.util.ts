export interface JsonSchemaLite {
  type?: 'object' | 'string' | 'number' | 'boolean' | 'array' | 'integer';
  properties?: Record<string, JsonSchemaLite>;
  required?: string[];
  items?: JsonSchemaLite;
}

function typeOf(value: unknown): string {
  if (Array.isArray(value)) {
    return 'array';
  }
  if (value === null) {
    return 'null';
  }
  return typeof value;
}

/**
 * A minimal JSON-Schema-subset validator — object/string/number/boolean
 * /array/integer, `properties`, `required`, `items` — deliberately not a
 * full ajv-style implementation. Used to validate a Custom AI Tool's
 * declared `responseSchema` against what the developer's own endpoint
 * actually returned (see ExtensionAiToolSourceService), so a malformed
 * response is rejected before ever reaching the AI runtime rather than
 * pulling in a general-purpose schema library for this one narrow use.
 */
export function validateAgainstJsonSchema(
  value: unknown,
  schema: JsonSchemaLite,
  path = '$',
): string[] {
  const errors: string[] = [];

  if (schema.type) {
    const actualType = typeOf(value);
    const matches =
      schema.type === 'integer'
        ? actualType === 'number' && Number.isInteger(value)
        : actualType === schema.type;

    if (!matches) {
      errors.push(`${path}: expected ${schema.type}, got ${actualType}`);
      return errors;
    }
  }

  if (schema.type === 'object' && value && typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    for (const key of schema.required ?? []) {
      if (!(key in obj)) {
        errors.push(`${path}.${key} is required`);
      }
    }
    for (const [key, subSchema] of Object.entries(schema.properties ?? {})) {
      if (key in obj) {
        errors.push(...validateAgainstJsonSchema(obj[key], subSchema, `${path}.${key}`));
      }
    }
  }

  if (schema.type === 'array' && Array.isArray(value) && schema.items) {
    value.forEach((item, index) => {
      errors.push(
        ...validateAgainstJsonSchema(item, schema.items as JsonSchemaLite, `${path}[${index}]`),
      );
    });
  }

  return errors;
}
