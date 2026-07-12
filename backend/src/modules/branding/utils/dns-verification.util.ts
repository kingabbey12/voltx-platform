import { resolveTxt } from 'node:dns/promises';
import { randomBytes } from 'node:crypto';

export function generateDomainVerificationToken(): string {
  return `voltx-domain-verify-${randomBytes(16).toString('hex')}`;
}

/**
 * Real DNS TXT lookup (no infra of our own involved) — the admin adds a
 * `TXT _voltx-verify.<domain>` record containing the token we generated,
 * and this checks it's actually there. A DNS lookup failure (NXDOMAIN, no
 * records, network error) is treated as "not yet verified", never thrown,
 * since a not-yet-propagated record is the expected common case, not an
 * application error.
 */
export async function verifyDomainOwnership(domain: string, token: string): Promise<boolean> {
  try {
    const records = await resolveTxt(`_voltx-verify.${domain}`);
    const flatRecords = records.map((chunks) => chunks.join(''));
    return flatRecords.includes(token);
  } catch {
    return false;
  }
}
