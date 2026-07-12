/**
 * v2.2 Security Center — org-level security policy (MFA-required, password
 * policy, IP allowlist). Per the release plan this deliberately has no
 * dedicated Prisma column: it lives inside the existing `Organization.settings`
 * Json under the `security` key, parsed/merged through this pure helper.
 *
 * This file intentionally has zero imports from the auth or security
 * modules — it's a plain data-shape helper so both `AuthService.login()`
 * (auth module, needs the MFA-required flag pre-JWT-issuance) and the
 * Security Center's policy endpoints (security module) can read/write the
 * exact same convention without either module depending on the other.
 */

export interface OrganizationPasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireNumber: boolean;
  requireSymbol: boolean;
}

export interface OrganizationSecurityPolicy {
  mfaRequired: boolean;
  passwordPolicy: OrganizationPasswordPolicy;
  /** Exact IPs and/or IPv4 CIDR ranges. Empty array = no restriction. */
  ipAllowlist: string[];
}

export const DEFAULT_ORGANIZATION_SECURITY_POLICY: OrganizationSecurityPolicy = {
  mfaRequired: false,
  passwordPolicy: {
    minLength: 8,
    requireUppercase: false,
    requireNumber: false,
    requireSymbol: false,
  },
  ipAllowlist: [],
};

/** Reads the `security` namespace out of an Organization's `settings` Json,
 * filling in any missing fields with the defaults above — never throws on
 * malformed/legacy settings, since `settings` is a free-form Json column
 * that predates this policy shape. */
export function parseOrganizationSecurityPolicy(settings: unknown): OrganizationSecurityPolicy {
  const raw =
    settings && typeof settings === 'object'
      ? (settings as Record<string, unknown>).security
      : undefined;

  if (!raw || typeof raw !== 'object') {
    return cloneDefault();
  }

  const source = raw as Record<string, unknown>;
  const passwordPolicySource =
    source.passwordPolicy && typeof source.passwordPolicy === 'object'
      ? (source.passwordPolicy as Record<string, unknown>)
      : {};

  return {
    mfaRequired: source.mfaRequired === true,
    passwordPolicy: {
      minLength:
        typeof passwordPolicySource.minLength === 'number' && passwordPolicySource.minLength > 0
          ? passwordPolicySource.minLength
          : DEFAULT_ORGANIZATION_SECURITY_POLICY.passwordPolicy.minLength,
      requireUppercase: passwordPolicySource.requireUppercase === true,
      requireNumber: passwordPolicySource.requireNumber === true,
      requireSymbol: passwordPolicySource.requireSymbol === true,
    },
    ipAllowlist: Array.isArray(source.ipAllowlist)
      ? source.ipAllowlist.filter((entry): entry is string => typeof entry === 'string')
      : [],
  };
}

export interface OrganizationSecurityPolicyUpdate {
  mfaRequired?: boolean;
  passwordPolicy?: Partial<OrganizationPasswordPolicy>;
  ipAllowlist?: string[];
}

/** Merges a partial policy update into the organization's existing
 * `settings` Json, leaving every other top-level settings key untouched. */
export function mergeOrganizationSecurityPolicy(
  existingSettings: unknown,
  update: OrganizationSecurityPolicyUpdate,
): Record<string, unknown> {
  const base =
    existingSettings && typeof existingSettings === 'object'
      ? { ...(existingSettings as Record<string, unknown>) }
      : {};
  const current = parseOrganizationSecurityPolicy(existingSettings);

  const merged: OrganizationSecurityPolicy = {
    mfaRequired: update.mfaRequired ?? current.mfaRequired,
    passwordPolicy: {
      ...current.passwordPolicy,
      ...update.passwordPolicy,
    },
    ipAllowlist: update.ipAllowlist ?? current.ipAllowlist,
  };

  base.security = merged;
  return base;
}

function cloneDefault(): OrganizationSecurityPolicy {
  return {
    mfaRequired: DEFAULT_ORGANIZATION_SECURITY_POLICY.mfaRequired,
    passwordPolicy: { ...DEFAULT_ORGANIZATION_SECURITY_POLICY.passwordPolicy },
    ipAllowlist: [...DEFAULT_ORGANIZATION_SECURITY_POLICY.ipAllowlist],
  };
}
