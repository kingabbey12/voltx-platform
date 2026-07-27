# Voltx v2.0.0-alpha — Release Notes

Branch: `release/v1.9.1` (merge commit `4f12beb`) · Tag: `v2.0.0-alpha` · Date: 2026-07-21

This is an **alpha**: feature-complete for the Today + Ask foundation, gated
for production by the blockers listed under Known limitations.

---

## New features

**Today** (`/today`, web) — the morning briefing as specified in the frozen
Today design: the AI-written brief in letter voice, the held-work ledger
backed by agent approvals (margin-line selection, sign with ⌘Enter, spent
rows kept as records), and the reply line. Full keyboard grammar
(type-anywhere, ⌘K, arrows, Enter/⌘Enter, Esc), designed focus system,
600 ms doing-lines instead of spinners, three-clause error grammar,
reduced-motion support. Coexists with `/dashboard`.

**Ask** (backend `src/modules/ai/ask/`) — the product-wide AI layer per
`docs/design/ASK.md`:
- `POST /api/v1/ai/ask/stream` (SSE): wraps the existing autonomous agent
  loop; streams whole sentences (never tokens), doing-lines naming actual
  tool work, held-work events, and a final structured response.
- **Grounding pipeline**: responses carry trust registers
  (evidence/record/opinion/inference). Doors (record links) are validated
  against the record ids tools actually returned this turn; ungrounded
  doors are stripped and ungrounded record-claims are demoted to inference.
  Enforced in code (`ask-response.parser.ts`), not requested in the prompt.
- `GET /api/v1/ai/ask/records/:type/:id`: resolves a door to one canonical
  record (label + route) under the caller's tenant scope and per-type RBAC.
  Types: sales.company/contact/lead/opportunity/activity, document,
  conversation, knowledge.document, knowledge.source, workflow.

**Tool grounding contract** — every production tool (47 static across 8
sources, plus all dynamically generated integration/extension tools)
implements `ground(input, output)`: owner-facing summary, affected canonical
records, resulting events. Aggregate tools ground summaries and honestly
claim no record ids; HTTP tools summarize by host only.

**Approval summaries** — `AgentActionApproval.summary` is written once at
creation (tool `describe(input)` hook, else the backend describer) and is
the only sentence clients render; the web no longer invents held-work text.

**Memory beliefs** — every AI memory exposes an inspectable belief
(confidence, source-record refs, last confirmation/contradiction) over the
row's metadata extension point, with audited
`POST /api/v1/ai/memories/:id/confirm` and `/:id/contradict`.

**Design foundations** — `docs/design/ASK.md` and `docs/design/COMPANY.md`
(the information architecture and its expansion test).

## Breaking changes

**None.** Every API change is additive (new endpoints; new nullable
response fields `approval.summary`, `memory.belief`; new optional AITool
hooks `ground`/`describe`). No environment variables were added to the
required set. The web app adds `/today` without touching existing routes.

## Database migrations

One, additive and zero-downtime safe:

- `20260720170602_agent_approval_summary` —
  `ALTER TABLE agent_action_approvals ADD COLUMN summary TEXT;`
  (nullable; no backfill required — existing approvals render the generic
  fallback sentence).

Caution for the operator: `prisma migrate dev` in this repo regenerates
destructive drift statements against the raw pgvector/tsvector constructs
(`knowledge_chunks.content_tsv`, HNSW index). This is long-standing; every
migration since `20260705093948_add_knowledge_graph_rag` hand-removes them.
`prisma migrate deploy` (the production path) replays the files as written
and is safe — verified end-to-end on a fresh database this release.

## Deployment steps

1. `cd backend && pnpm install --frozen-lockfile`
2. `pnpm prisma:migrate:deploy` (applies the one new migration)
3. `pnpm build` and restart the API (production requires `REDIS_ENABLED=true`
   with Redis reachable — enforced at boot; `docker-compose.prod.yml`
   includes the Redis service).
4. Web: `pnpm install --frozen-lockfile && pnpm build` with
   `NEXT_PUBLIC_API_BASE_URL` set; deploy `.next` output.
5. Smoke: `GET /health` returns 200; authenticated
   `GET /api/v1/ai/ask/records/workflow/<known-id>` returns the descriptor;
   `/today` renders the brief and ledger for a seeded org.

See `DEPLOYMENT_CHECKLIST.md` for the full gate list.

## Rollback steps

1. Redeploy the previous backend build (tag `v1.9.1` lineage, commit
   `31f947e`). The new column is nullable and unread by old code — **no
   schema rollback required**.
2. If a hard schema revert is demanded:
   `ALTER TABLE agent_action_approvals DROP COLUMN summary;` and
   `prisma migrate resolve --rolled-back 20260720170602_agent_approval_summary`.
3. Web: redeploy the previous build; `/today` disappears with it. No data
   to clean up — Today writes only through existing approval/agent paths.

## Known limitations

1. **Full e2e is CI-gated, not locally green**: suites requiring Stripe
   keys, AI provider credentials, or long serial runtimes (billing,
   security center, workflow engine streaming, invitations) need the full
   CI environment. Sprint-surface suites (ai-tools, ai-memories,
   ai-operator-approvals, tenant-isolation, workflow-webhooks) pass against
   a seeded local database.
2. Doors to documents and knowledge records resolve labels but not routes
   (no standalone pages yet); the promise/asset primitives of COMPANY.md
   await schema reconciliation — no `asset` door type exists.
3. Ask streaming reconnect is pre-first-event only; mid-stream resume from
   `Last-Event-ID` is not implemented (sequence ids are already on the wire).
4. Today ships fixed-light at desktop widths; dark theme, sub-1280 layouts,
   ⌘1–3 place shortcuts, and a screen-reader session remain open (tracked
   in the frozen spec's imperfections list).
5. Memory belief confirm/contradict is last-write-wins (no optimistic
   locking); approval `EXPIRED` status exists but no automatic expiry sweep
   was verified.
6. Web has no test infrastructure (type/lint/build gates only).
7. `.env.example` documents fewer optional variables than
   `env.validation.ts` accepts (attachments storage, ClamAV, replica URL,
   AI HTTP tool allowlist) — documentation drift, not a startup risk.
