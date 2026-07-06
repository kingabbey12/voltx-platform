/** Narrows an untyped action/tool input field to a string without risking `String(obj)` producing "[object Object]". */
export function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

/** Same as asString, but returns undefined instead of a fallback when the field is absent/non-string — for optional inputs. */
export function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
