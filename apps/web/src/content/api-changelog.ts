/**
 * Versioned Voltx public API changelog — checked into the repo (not a
 * CMS). Add a new entry here whenever a developer-facing API change ships;
 * this is rendered directly by /developers/changelog.
 */
export interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  changes: string[];
}

export const API_CHANGELOG: ChangelogEntry[] = [
  {
    version: "v2.3",
    date: "2026-07-13",
    title: "Developer Platform",
    changes: [
      "New: Personal Access Tokens and Service Accounts for machine-to-machine access.",
      "New: Voltx as an OAuth 2.0 authorization server (authorization_code + PKCE, refresh, revoke, introspect).",
      "New: Outbound webhooks with HMAC-signed deliveries, automatic retry, and replay.",
      "New: this Developer Portal, plus a live OpenAPI 3.1 reference and interactive playground.",
      "Changed: the OpenAPI document is now genuinely 3.1/JSON-Schema-2020-12 compliant (no more `nullable: true`).",
    ],
  },
  {
    version: "v2.2",
    date: "2026-05-01",
    title: "Enterprise Platform",
    changes: [
      "New: SSO (SAML/OIDC) and SCIM 2.0 provisioning.",
      "New: organization hierarchy (business units, departments, teams, cost centers).",
      "New: Security Center — MFA, sessions, trusted devices, API keys, IP allowlisting.",
      "New: white-label branding and custom domains.",
      "New: Platform Console for cross-organization support and billing operations.",
    ],
  },
  {
    version: "v2.1",
    date: "2026-02-15",
    title: "Billing",
    changes: [
      "New: subscriptions, seat-based billing, usage metering, and the Stripe Customer Portal.",
    ],
  },
  {
    version: "v2.0",
    date: "2025-11-01",
    title: "Workflow Automation",
    changes: [
      "New: the workflow engine — steps, triggers, schedules, approvals, and retries.",
    ],
  },
];
