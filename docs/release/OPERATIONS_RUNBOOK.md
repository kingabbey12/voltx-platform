# Operations Runbook — v2.0.0-alpha (Today + Ask)

Extends `operational-runbook.md` (platform-wide procedures). This runbook
covers operating the subsystems new in v2.0.0-alpha.

## Architecture in one paragraph

`/today` (web) reads the morning brief (an autonomous agent run under the
operator session), the held-work ledger (`GET /ai/approvals`), and speaks to
Ask (`POST /ai/ask/stream`, SSE). Ask wraps the existing autonomous agent
loop: tools execute tenant-scoped and permission-filtered, each returning a
grounding envelope; the model's output is parsed against the response
contract and ground-checked before the client ever sees a structured
response. Doors resolve through `GET /ai/ask/records/:type/:id`. Approvals
created by any tool call carry a stored `summary`. Nothing in Ask executes
from inference — mutations pause as approvals and resume on human decision.

## Key operational surfaces

| Concern | Where to look |
|---|---|
| Liveness | `GET /health` (also `/metrics`) |
| A stuck Ask turn | `agent_runs` table: status RUNNING with old `started_at`; the SSE disconnect aborts the run via signal — a RUNNING run without a live request is a leak, see below |
| Held work | `agent_action_approvals`: PENDING rows are the ledger; `summary` should be non-null for all rows created ≥ v2.0.0-alpha |
| Grounding health | `ungroundedDoorsRemoved` on Ask structured responses; tool grounding failures log as `AI tool grounding hook failed` (warn — execution continues) |
| AI spend | `AiUsageLog` / `get_ai_cost_summary` tool / usage dashboards |
| Audit trail | `audit_logs`: `ai.approval.requested`, approval decisions, memory `confirm`/`contradict` |

## Incident procedures

**Ask answers arrive with no doors / everything hedged as inference.**
Working as designed if tools returned no records (check `tool_executions`
for the conversation): the pipeline demotes rather than invents. If tools
DID return records, check the `ask-response` fence parsing — a model/prompt
regression shows up as `ungroundedDoorsRemoved` spikes or contract-ignoring
prose (degrades to inference-register paragraphs, never fabricated facts).

**Ask stream hangs or the client cannot cancel.**
The SSE transport aborts the run when the response closes (verified chain:
response close → AbortController → agent loop → tool executor). If
`agent_runs` accumulate RUNNING rows with no live connections, restart the
API pod (safe: runs are per-turn, not durable jobs) and capture logs —
that chain has a leak.

**Approvals pile up PENDING.**
They do not expire automatically (`EXPIRED` status exists; no sweep job —
known limitation). Owners decide via Today's ledger or `/ai/operator`.
A stuck WAITING_APPROVAL run resumes on decision through
`AgentApprovalDecisionService`; if a decision doesn't resume the run, check
the resume service logs for that approval id.

**Doors 404 for records the user can see in the UI.**
Expected for cross-tenant or deleted ids (indistinguishable by design).
For same-tenant live records, check the type is one the resolver binds
(`sales.*`, `document`, `conversation`, `knowledge.document`,
`knowledge.source`, `workflow`) — an unknown type is NotFound by contract.
403 with "outside what your role can see" is RBAC, not absence.

**The Today brief is empty or erroring.**
The brief needs a working AI provider and the operator session
(`POST /ai/operator/session`). Its error state on screen is the three-clause
grammar with a Try again — silent blankness is a bug, honest failure is not.
The brief is day-cached per org in the browser (localStorage), so a fix
appears for users after retry or next day.

**Registration 404s ("Plan \"free\" not found").**
`pnpm prisma:seed:billing-plans` was not run against this database.
Registration creates a billing account + free subscription; seed the plan
catalog. (Also required in test databases.)

## Memory beliefs

`GET /ai/memories` now exposes `belief` per memory. Confirm/contradict are
owner actions, audited, tenant+user scoped. Beliefs are rebuildable data in
`metadata`; deleting a memory (soft) is always safe. Note: belief updates
are last-write-wins — concurrent confirm/contradict on the same memory can
drop one adjustment (accepted for alpha).

## Migration operations

`prisma migrate deploy` only, in production. Never run `migrate dev`
against a shared database: it regenerates destructive drift against the
pgvector/tsvector raw constructs (`knowledge_chunks`). If a migration is
authored, hand-remove the drift artifacts per the convention documented in
every migration since `20260705093948_add_knowledge_graph_rag`, and verify
with a fresh-database `migrate deploy` replay.

## Feature kill options

No feature flags exist for Today/Ask (alpha). Coarse controls:
- Remove `ai.agent.run` from roles to disable Ask/brief org-wide (RBAC
  gate on the endpoints).
- Web-side, `/today` is additive; a routing rollback of the web deploy
  removes it without backend impact.
