const MAX_SLUG_LENGTH = 100;

export function slugifyOrganizationName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
    .slice(0, MAX_SLUG_LENGTH);

  return slug.length > 0 ? slug : 'organization';
}

export function buildSlugCandidate(baseSlug: string, suffix: number): string {
  if (suffix <= 1) {
    return baseSlug;
  }

  const suffixPart = `-${String(suffix)}`;
  const maxBaseLength = MAX_SLUG_LENGTH - suffixPart.length;
  const trimmedBase = baseSlug.slice(0, Math.max(maxBaseLength, 1));

  return `${trimmedBase}${suffixPart}`;
}

export async function generateUniqueOrganizationSlug(
  name: string,
  isSlugTaken: (slug: string) => Promise<boolean>,
): Promise<string> {
  const baseSlug = slugifyOrganizationName(name);
  let suffix = 1;

  while (suffix <= 1000) {
    const candidate = buildSlugCandidate(baseSlug, suffix);
    const taken = await isSlugTaken(candidate);

    if (!taken) {
      return candidate;
    }

    suffix += 1;
  }

  throw new Error(`Unable to generate unique slug for organization name "${name}"`);
}
