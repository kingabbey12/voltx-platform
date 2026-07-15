# Data model

This is a map for finding your way around `backend/prisma/schema.prisma`
(1000+ lines across every domain module), not a full ERD. Read the schema
file itself for exact fields/types — this doc explains the *shape* and the
handful of conventions that aren't obvious from the field list alone.

## Tenancy core

- **`Organization`** — the tenant boundary. Almost every other model either
  has a direct `organizationId` or reaches one through a relation.
- **`User`** — a person, not scoped to one organization. The same user row
  can belong to multiple orgs.
- **`Membership`** — the join between `User` and `Organization`, carrying a
  `roleId` and a `status` (so removing someone from an org is a status
  change, not a delete). A user can hold multiple active `Membership` rows
  at once — that's how multi-org-per-user works (switch-organization just
  reissues a JWT scoped to a different membership's org, no re-login).
- **`Role`** / **`Permission`** / **`RolePermission`** — RBAC. `Role.organizationId`
  is nullable: `null` means a seeded system role (`isSystem: true`, shared
  and immutable across every organization — owner/admin/manager/member/
  viewer, see `prisma/seed.ts`'s `ROLE_DEFINITIONS`); set means a custom
  role an organization created for itself (`src/modules/roles/`). `Role.key`
  stays **globally** unique across every org rather than scoped per-org —
  Postgres treats `NULL` values as distinct in a unique index, which would
  make a `(organizationId, key)` composite unique constraint unsound for
  system roles, so custom role keys are instead de-duplicated at creation
  time with a numeric-suffix retry (`generateUniqueRoleKey`,
  `src/modules/roles/utils/role-key.util.ts` — the same pattern
  `generateUniqueOrganizationSlug` uses for organization slugs). System
  roles can never be updated or deleted via the API, regardless of the
  caller's permissions — see `RoleService.getMutableCustomRoleOrThrow`.

## Sessions and tokens

- **`Session`** — one row per login, tracks `deviceFingerprint`/`ipAddress`/
  `userAgent`/`lastActiveAt`/`revokedAt`. This is what the Security Center's
  "active sessions" and "login history" screens read from directly — login
  history needs no separate audit mechanism because a `Session` row is
  created exactly once per successful login and never deleted, only
  revoked.
- **`RefreshToken`** — hashed at rest, always references the `Session` it
  was issued under (`sessionId`, nullable only for tokens issued before this
  column existed). Rotates on every `/auth/refresh` call: the old token is
  revoked, a new one is created under the *same* `Session`, so revoking a
  `Session` cascades to every `RefreshToken` descended from it, however many
  times it's been rotated.
  - **Reuse detection**: presenting a refresh token that exists but is
    already revoked (not merely expired, and not simply never-issued) is
    treated as a stolen/replayed-token signal — see
    `handlePossibleRefreshTokenReuse` in
    `backend/src/modules/auth/auth.service.ts`. It revokes the entire
    `Session` (killing every sibling `RefreshToken`) and writes an
    `auth.refresh_token_reuse_detected` audit event. The response to
    whoever presented the replayed token is identical to any other
    invalid-token error — this only changes server-side blast-radius
    containment, it isn't observable to an attacker.

## Audit log

**`AuditLog`** backs the Compliance Center's audit export. Every row is
scoped to one `organizationId` and one `userId` (the actor — see
`recordWithExplicitActor` in `backend/src/modules/audit/audit.service.ts`
for the handful of call sites, like login/register, that write one before
any JWT-derived tenant context exists). The distinctive part is a
tamper-evident hash chain, computed in `AuditRepository.write()`
(`backend/src/modules/audit/audit.repository.ts`):

- Each row's `hash` is `sha256(previousHash + canonical row payload)`,
  where `previousHash` is the `hash` of the immediately preceding row **for
  the same `organizationId`** — each org has its own independent chain.
- The read-latest-then-insert-next-link sequence runs inside a Postgres
  transaction guarded by `pg_advisory_xact_lock(hashtext(organizationId))`,
  so two concurrent requests for the same org can never both read the same
  "latest" row and fork the chain into two branches claiming the same
  parent.
- Rows written before this feature existed have a `null` hash and are
  skipped (not reported as broken) by `GET /compliance/audit/verify`.

If you're adding a new sensitive action anywhere in the codebase, call
`AuditService.record()` (uses the current tenant context) or
`recordWithExplicitActor()` (no tenant context yet, e.g. pre-auth) rather
than writing directly to the `AuditLog` table — that's what keeps the chain
correctly ordered and locked.

## Tenant-scoping convention

Most domain tables (sales, billing, marketplace, compliance, workflows,
etc.) carry a direct `organizationId` column and are expected to be scoped
by every query that touches them. `organization`/`user`/`membership`
queries additionally get automatic scoping from the Prisma tenant extension
(see `docs/architecture/overview.md`'s Multi-tenancy section) as
defense-in-depth — but that extension does **not** cover every table, so
domain repositories still must filter by `organizationId` explicitly rather
than relying on the extension to save them. When adding a new
tenant-scoped model, follow an existing repository in `sales/` or `billing/`
as the pattern, not the extension's short table list.
