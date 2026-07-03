import {
  buildSlugCandidate,
  generateUniqueOrganizationSlug,
  slugifyOrganizationName,
} from '../src/modules/organization/utils/organization-slug.util';

describe('organization-slug.util', () => {
  describe('slugifyOrganizationName', () => {
    it('converts name to a lowercase hyphenated slug', () => {
      expect(slugifyOrganizationName('Acme Corporation')).toBe('acme-corporation');
    });

    it('strips special characters and collapses separators', () => {
      expect(slugifyOrganizationName('  Hello!!! World  ')).toBe('hello-world');
    });

    it('returns fallback slug for empty result', () => {
      expect(slugifyOrganizationName('!!!')).toBe('organization');
    });
  });

  describe('buildSlugCandidate', () => {
    it('returns base slug for first candidate', () => {
      expect(buildSlugCandidate('acme-corporation', 1)).toBe('acme-corporation');
    });

    it('appends numeric suffix for subsequent candidates', () => {
      expect(buildSlugCandidate('acme-corporation', 2)).toBe('acme-corporation-2');
      expect(buildSlugCandidate('acme-corporation', 3)).toBe('acme-corporation-3');
    });
  });

  describe('generateUniqueOrganizationSlug', () => {
    it('returns base slug when available', async () => {
      const slug = await generateUniqueOrganizationSlug('Acme Corporation', () =>
        Promise.resolve(false),
      );

      expect(slug).toBe('acme-corporation');
    });

    it('appends -2, -3 when base slug is taken', async () => {
      const taken = new Set(['acme-corporation', 'acme-corporation-2']);
      const slug = await generateUniqueOrganizationSlug('Acme Corporation', (candidate) =>
        Promise.resolve(taken.has(candidate)),
      );

      expect(slug).toBe('acme-corporation-3');
    });
  });
});
