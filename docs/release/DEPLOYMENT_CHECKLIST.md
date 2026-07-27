# Deployment Checklist — v2.0.0-alpha

Companion to `RELEASE_NOTES_v2.0.0-alpha.md`. Extends (does not replace)
`production-checklist.md` and `beta-deployment-checklist.md`; run those
first for the platform-wide gates, then this list for what v2.0.0-alpha
adds.

## Before deploying

- [ ] CI green on `release/v1.9.1` at tag `v2.0.0-alpha`: backend lint,
      typecheck, unit (169 suites), **full e2e with the complete CI
      environment** (Stripe test keys, AI provider keys, seeded database —
      the local 5-var environment cannot run the billing/security suites),
      backend build, web tsc/eslint/build.
- [ ] Database seeded: `pnpm prisma:seed` (roles/permissions — includes the
      new-in-lineage `ai.*` keys) **and** `pnpm prisma:seed:billing-plans`
      (registration creates a free-plan subscription and 404s without it).
- [ ] Confirm `REDIS_ENABLED=true` and Redis reachable — production boot
      refuses to start without it (verified guard).
- [ ] Confirm AI provider credentials present for at least one provider —
      Ask and the Today brief degrade to their error grammar without them
      (honest, but empty).
- [ ] Backup: snapshot the database before migrating (standard), though the
      only migration is additive.

## Deploy

- [ ] `pnpm prisma:migrate:deploy` — applies
      `20260720170602_agent_approval_summary` (additive column; verified to
      replay on a fresh database with the full 46-migration history).
- [ ] Deploy backend build; watch boot logs for the env-guard errors
      (they name exactly what is missing).
- [ ] Deploy web build with `NEXT_PUBLIC_API_BASE_URL` set (build fails
      closed without it — by design).

## Smoke tests (in order)

- [ ] `GET /health` → 200.
- [ ] Login → `GET /api/v1/ai/approvals` → 200; any pending approval has a
      non-null `summary` **if created post-deploy** (older rows render the
      fallback sentence — expected).
- [ ] `POST /api/v1/ai/ask/stream` with a trivial prompt → SSE frames
      arrive (`sentence`…`response`…`done`), and cancelling the request
      mid-stream terminates the run (check agent run status becomes
      cancelled, not stuck RUNNING).
- [ ] `GET /api/v1/ai/ask/records/workflow/<known-id>` → label + route;
      same call with another org's id → 404; without `workflow.read` → 403
      with the role-boundary message.
- [ ] `/today` renders: date and reply line immediately; brief and ledger
      arrive together; signing a held row flips its verb to Sent and the
      underlying approval to APPROVED.
- [ ] `POST /api/v1/ai/memories/<id>/confirm` → belief.confidence rises and
      the action lands in the audit log.

## After deploying

- [ ] Watch `ungroundedDoorsRemoved` in Ask responses (surfaced in the
      structured payload) — a rising rate means the model is inventing
      record claims and the contract prompt needs attention.
- [ ] Watch AI usage cost (`get_ai_cost_summary` / AiUsageLog): Ask adds a
      response-contract overhead to every turn; no budget alarms exist yet.
- [ ] Confirm no elevated 403/404 rates on `/api/v1/ai/ask/records/*`
      (would indicate the model emitting cross-tenant or stale ids).

## Rollback triggers

Roll back (see release notes §Rollback) if: Ask streams hang without
terminating runs; approval decide errors spike; or `/today` errors exceed
the error-grammar paths (blank screens rather than honest failures).
