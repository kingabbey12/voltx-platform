/**
 * Minimal, dependency-free IP allowlist matcher: exact-match for any
 * address, plus IPv4 CIDR ranges (e.g. "10.0.0.0/8"). IPv6 CIDR ranges are
 * a known limitation — only exact IPv6 matches are supported (documented in
 * the Security Center's PATCH /organizations/:id/security-policy docs).
 */
export function ipMatchesAllowlist(ip: string, allowlist: string[]): boolean {
  const normalizedIp = normalizeIp(ip);
  return allowlist.some((entry) => ipMatchesEntry(normalizedIp, entry));
}

function ipMatchesEntry(ip: string, entry: string): boolean {
  const trimmed = entry.trim();
  if (trimmed === ip) {
    return true;
  }

  const cidrMatch = /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\/(\d{1,2})$/.exec(trimmed);
  if (!cidrMatch) {
    return false;
  }

  const [, rangeIp, prefixLengthRaw] = cidrMatch;
  const prefixLength = Number.parseInt(prefixLengthRaw, 10);
  const ipInt = ipv4ToInt(ip);
  const rangeInt = ipv4ToInt(rangeIp);
  if (ipInt === null || rangeInt === null || prefixLength < 0 || prefixLength > 32) {
    return false;
  }

  if (prefixLength === 0) {
    return true;
  }

  const mask = ~((1 << (32 - prefixLength)) - 1) >>> 0;
  return (ipInt & mask) === (rangeInt & mask);
}

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) {
    return null;
  }

  let result = 0;
  for (const part of parts) {
    const value = Number.parseInt(part, 10);
    if (Number.isNaN(value) || value < 0 || value > 255) {
      return null;
    }
    result = (result << 8) | value;
  }
  return result >>> 0;
}

/** Express's `request.ip` reports IPv4-mapped IPv6 addresses (e.g.
 * "::ffff:203.0.113.7") for IPv4 clients behind some proxies/sockets —
 * strip the mapping prefix so plain IPv4 allowlist entries still match. */
function normalizeIp(ip: string): string {
  return ip.startsWith('::ffff:') ? ip.slice('::ffff:'.length) : ip;
}
