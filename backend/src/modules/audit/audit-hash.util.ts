import { createHash } from 'node:crypto';

export interface AuditLogHashInput {
  organizationId: string;
  userId: string;
  requestId: string;
  action: string;
  resource: string;
  resourceId: string | null;
  metadata: unknown;
  previousHash: string | null;
  createdAt: Date;
}

/**
 * Deterministic JSON serialization (object keys sorted recursively) so the
 * exact same logical row content always hashes to the same value regardless
 * of insertion/property order — required for GET /compliance/audit/verify to
 * recompute this exact hash from a row read back out of the database later.
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const entries = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`);
  return `{${entries.join(',')}}`;
}

/**
 * Computes the tamper-evident hash for one AuditLog row: sha256 of the
 * previous row's hash (empty string for the first chained row in an
 * organization's history) concatenated with a canonical serialization of
 * this row's own content. Folding previousHash into the digest is what
 * makes altering, deleting, or reordering any historical row detectable —
 * every hash computed after the tampered point stops matching what's
 * stored, and GET /compliance/audit/verify reports the first index where
 * that happens.
 */
export function computeAuditLogHash(input: AuditLogHashInput): string {
  const payload = stableStringify({
    organizationId: input.organizationId,
    userId: input.userId,
    requestId: input.requestId,
    action: input.action,
    resource: input.resource,
    resourceId: input.resourceId,
    metadata: input.metadata,
    createdAt: input.createdAt.toISOString(),
  });

  return createHash('sha256')
    .update(input.previousHash ?? '')
    .update(payload)
    .digest('hex');
}
