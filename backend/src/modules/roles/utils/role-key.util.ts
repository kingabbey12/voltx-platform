const MAX_KEY_LENGTH = 100;

/** Mirrors organization-slug.util.ts's slugifyOrganizationName exactly —
 * same "lowercase, strip diacritics, collapse to hyphens" shape, since
 * role keys are just another globally-unique slug column. */
export function slugifyRoleName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
    .slice(0, MAX_KEY_LENGTH);

  return slug.length > 0 ? slug : 'role';
}

function buildKeyCandidate(baseKey: string, suffix: number): string {
  if (suffix <= 1) {
    return baseKey;
  }

  const suffixPart = `-${String(suffix)}`;
  const maxBaseLength = MAX_KEY_LENGTH - suffixPart.length;
  const trimmedBase = baseKey.slice(0, Math.max(maxBaseLength, 1));

  return `${trimmedBase}${suffixPart}`;
}

/**
 * Role.key is unique across every organization, not just within one — a
 * custom role named "Sales Manager" in org A and another in org B both
 * slugify to "sales-manager", so this retries with a numeric suffix
 * exactly like generateUniqueOrganizationSlug does for organization slugs,
 * rather than scoping uniqueness per-organization at the schema level
 * (which Postgres's NULL-is-distinct index semantics would make unsound
 * for system roles, whose organizationId is always null).
 */
export async function generateUniqueRoleKey(
  name: string,
  isKeyTaken: (key: string) => Promise<boolean>,
): Promise<string> {
  const baseKey = slugifyRoleName(name);
  let suffix = 1;

  while (suffix <= 1000) {
    const candidate = buildKeyCandidate(baseKey, suffix);
    const taken = await isKeyTaken(candidate);

    if (!taken) {
      return candidate;
    }

    suffix += 1;
  }

  throw new Error(`Unable to generate unique role key for name "${name}"`);
}
