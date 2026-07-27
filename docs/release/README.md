# Release & Operations — Start Here

This directory accumulated eleven overlapping documents across earlier release cycles: three operations runbooks, two known-issues lists, two rollback documents and four deployment checklists. At 03:00 during an incident, "which of these three runbooks is right?" is itself an outage extender.

**This page is the index. One document is authoritative per task. Everything else is superseded and kept only for history.**

## Authoritative documents

| If you need to… | Use | Not |
|---|---|---|
| **Deploy** (staging or production) | [`docs/production-deployment.md`](../production-deployment.md) | `DEPLOYMENT_CHECKLIST.md`, `production-checklist.md`, `beta-deployment-checklist.md` |
| **Roll back** | [`docs/rollback-plan.md`](../rollback-plan.md) | `rollback-checklist.md` |
| **Respond to an alert** | [`docs/operations/monitoring-and-alerting.md`](../operations/monitoring-and-alerting.md) — one runbook section per alert | — |
| **Run day-to-day ops / incident response** | [`docs/operations-runbook.md`](../operations-runbook.md) | `OPERATIONS_RUNBOOK.md`, `operational-runbook.md` |
| **Back up or restore** | [`docs/operations/backup-and-restore.md`](../operations/backup-and-restore.md) | — |
| **Know what is broken or unproven** | [`docs/known-issues.md`](../known-issues.md) | `known-issues.md` (in this directory) |
| **Understand the architecture** | [`docs/architecture.md`](../architecture.md) | — |
| **Read a past incident** | [`docs/operations/incident-2026-07-26-api-oom.md`](../operations/incident-2026-07-26-api-oom.md) | — |
| **Launch checklist** | [`docs/launch-checklist.md`](../launch-checklist.md) | — |

Superseded files are left in place because they are referenced by older release notes. **Do not update them.** If you find yourself editing one, you are editing the wrong file.

---

## Beta release gate

RC1 is not ready to tag until all of these are true. Each is verified or explicitly not.

| # | Gate | Status |
|---|---|---|
| 1 | **All work committed and reviewed** | ❌ **BLOCKED** — 133 files uncommitted; `HEAD` predates six hardening cycles |
| 2 | Version bumped, tagged, changelog written | ❌ backend still `0.0.1`; no `CHANGELOG.md` |
| 3 | Alert receiver configured | ❌ placeholder in `deploy/alertmanager/webhook_url` |
| 4 | Daily backup cron installed | ❌ documented, not installed |
| 5 | Build / lint / types / tests green | ✅ 186 suites, 1,478 tests; zero vulnerabilities |
| 6 | Deployment succeeds, services healthy | ✅ 11 services up; api + web + postgres + redis healthy |
| 7 | Monitoring active | ✅ 7/7 scrape targets up |
| 8 | Alerting functional | ✅ fire → route → **deliver** observed end-to-end |
| 9 | No false-positive alerts | ✅ 0 firing on a healthy system |
| 10 | Logs flowing | ✅ structured, request-id correlated |
| 11 | Backup verified | ✅ executed 2026-07-26, integrity check passed |
| 12 | Restore verified | ✅ destroy → restore → byte-identical data |
| 13 | Rollback rehearsed | ⚠️ image redeploy verified; **tagged-version rollback not rehearsed** |
| 14 | Load tested | ⚠️ 5.9M requests, 0 failures — unauthenticated endpoints only |

**Gates 1–4 are the beta blockers. None require engineering — they require a commit, a version bump, one config line and one cron entry.**

---

## Incident response — first five minutes

1. **Check the alert's runbook link.** Every alert carries one; it names the likely cause and the first commands to run.
2. **Is it a real incident?** `curl -f https://<host>/readiness` — 503 means a dependency is down; 200 means the API is serving.
3. **Establish blast radius.** `ApiDown` = everything. `WebDown` = UI only, API may be fine. A datastore alert = treat app alerts as symptoms.
4. **Did a deploy just happen?** If yes, roll back first and diagnose after — see `docs/rollback-plan.md`.
5. **Capture before restarting.** `docker compose -f deploy/docker-compose.yml logs api --tail=500 > /tmp/incident-$(date +%s).log`. A restart destroys the evidence.

**Escalation:** alerts route to the single webhook in `deploy/alertmanager/webhook_url`. There is **no rota, no escalation tier and no acknowledgement path** — during beta, whoever is watching that channel is on call. Establish a rota before general availability.

**Known trap:** on Alpine, a fatal Node error exits **139 (SIGSEGV)**, not 134. Read the container logs before concluding it is a native crash — see the OOM incident report.

---

## Beta customer onboarding

1. Confirm the customer's origin is in `CORS_ALLOWED_ORIGINS` — browser clients get opaque failures otherwise.
2. Create their organization and invite the first admin; they self-serve users from there.
3. Walk through the limitations in [`known-issues.md`](../known-issues.md) — particularly that **deploys cause a brief interruption** during beta.
4. Give them a direct support channel. With a handful of customers, a shared channel beats a ticketing system.
5. Tell them what you are measuring and ask for what you cannot see: perceived slowness, confusing flows, anything they expected to exist.

## What to watch in the first two weeks

| Signal | Where | Healthy |
|---|---|---|
| Error rate | Grafana / `HighServerErrorRate` | < 1% 5xx |
| p99 latency | Grafana | < 250 ms (non-AI routes) |
| API memory | `voltx_process_resident_memory_bytes` | Flat. **Sustained growth is the OOM signature** |
| Queue depth | `voltx_queue_depth{state="waiting"}` | Near zero; sustained backlog means workers are behind |
| Restart count | `docker inspect ... RestartCount` | **0.** Any increase warrants investigation |
| Alert volume | Alertmanager | A page that is not actionable is a bug in the rule — fix the rule |
