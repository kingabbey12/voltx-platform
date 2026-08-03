# Autonomous Workflow Engine (VT-205)

The Autonomous Workflow Engine turns verified Executive Decisions into **approval-gated workflow plans**. Despite the name it is not autonomous in the sense of acting on its own: it plans, it asks a human, and it hands approved work to the existing workflow module. It never performs a business action.

## The four boundaries

The name of each boundary matters, because only the first three belong to the AI module:

| # | Boundary | Owner | What happens |
| --- | --- | --- | --- |
| 1 | **Plan generation** | AI module | Deterministic rules turn decisions into plans. No side effects on the business. |
| 2 | **Approval submission** | AI module → existing approval framework | The plan enters `AgentActionApproval` and the existing approver inbox. |
| 3 | **Approved handoff** | AI module → existing workflow module | Validated, translated, and given to `WorkflowService`. |
| 4 | **Workflow execution** | **Existing workflow module only** | The run is driven, retried and completed entirely outside the AI module. |

Nothing in the AI module can set a plan to "executed": the `AiWorkflowPlanStatus` enum has no such member, and `WorkflowPlanStatus` terminates at `handed_off`.

## Planning-only boundary

`workflow-engine.engine.ts` is pure and synchronous. Its dependency graph contains no Prisma client, no domain repository and no AI provider — it receives `ExecutiveDecisionsResult` and returns plans. The single file in the module that touches Prisma is `workflow-engine.repository.ts`, and it touches exactly one table: the engine's own plan store.

### Rules, limits and ordering

A decision becomes a plan only if it is **plannable** and **requires approval**. A decision needing no approval is a briefing, not a plan, so `executive_priority` never produces one.

| Setting | Value | Why |
| --- | --- | --- |
| Plannable categories | sales, finance, operations, communications, customer_success, risk, compliance | Every category that describes approvable work |
| `MAX_PLANS` | 10 | Bounds the response at volume |
| `MAX_STEPS_PER_PLAN` | 6 (4 emitted) | Bounds the approval payload |
| `MAX_PLAN_EVIDENCE` | 5 | Bounds evidence per plan |
| `PLAN_TTL_MS` | 24 h | A plan describes today's priorities |

Ordering is `priority desc → risk desc → decision id asc`; evidence is `priority desc → id asc`. Both are total orders, so repeated generation is byte-identical.

Every plan carries the same four steps — `review` → `draft` → `notify` → `suggest_approval`. Each is preparation, drafting, notification or a request for approval; none names a business mutation. Duration is the sum of fixed per-type minute estimates, so it is deterministic too.

### Idempotency: the plan key

`planKey = sha256(planVersion | decisionId | category | priority | riskLevel | actionCode | sortedPermissions)[0..32]`

It is stable across regenerations of the same decision, and changes whenever anything a human would be approving changes. Permission *ordering* is normalised out, because reordering is not a semantic change. The store is unique on `(organizationId, userId, planKey)`, which is what makes repeated generation return the same plan row rather than piling up duplicates.

## Persistence decision

Persistence **is** required. `GET /ai/workflow-plans` needs a durable source of plans; approval state must be synchronised against an authoritative record; expiry, handoff idempotency and audit traceability all need a row that outlives the request.

`AiWorkflowPlan` stores id, tenant, user, plan key, plan version, the plan JSON, status, approval id, workflow id, workflow execution id, and the created/updated/expires/approved/rejected/handed-off/deleted timestamps. The stored body is the already-sanitised planner output — **no raw prompt is persisted**, because no retention policy requires one.

The model is registered in the central tenant Prisma extension (`aiWorkflowPlan: standardInterceptor`), so every unscoped read is filtered by organisation before it reaches Postgres. The repository additionally scopes by `organizationId` explicitly: a plan id from another tenant resolves to `null`, so cross-tenant reads return 404 rather than leaking existence.

## Approval integration

There is exactly one approval framework. Rather than forking a second one, the existing `AgentActionApproval` model was widened:

- `agentRunId` became nullable — a plan has no agent run behind it.
- `resourceType` / `resourceId` were added, so a non-tool-call approval can name what it is about.
- `CANCELLED` was added to `AgentActionApprovalStatus` for the plan lifecycle.
- `AgentApprovalService.findOrCreatePendingForResource()` is the new entry point; it is idempotent per resource.
- `AgentApprovalDecisionService` now skips the run-resume path when `agentRunId` is null.

Plans therefore appear in the same approvals table, the same approver inbox, and are decided through the same endpoint as every other AI approval.

### Approval payload

Carries: plan id, plan version, title, objective, priority, risk, required permissions, required roles, ordered steps, decision ids, insight ids, context sources, evidence **references**, requesting user, tenant, expiry and the approval reason. It deliberately carries no secret, no credential and no full communication body — evidence travels as `{ id, label }` only.

### State mapping

| Approval | Plan |
| --- | --- |
| `PENDING` | `awaiting_approval` |
| `APPROVED` | `approved` |
| `REJECTED` | `rejected` |
| `CANCELLED` | `cancelled` |
| `EXPIRED` | `expired` |

Expiry outranks a still-actionable state: an `awaiting_approval` or `approved` plan past its expiry reports `expired`, so the listing can never show a plan as ready to hand off after the handoff has begun refusing it. An approval belonging to a different tenant never drives a plan, even though the repository is already scoped.

## Handoff contract

`WorkflowPlanExecutionHandoff` contains no execution logic. It validates, translates and delegates:

1. Plan exists **in this tenant** (else 404).
2. Already handed off → replay the recorded identifiers.
3. Approval state re-synchronised from the authoritative approval.
4. Status is `approved` (else 400).
5. Not expired (else 400, and the plan is marked expired).
6. Plan version matches what was approved (else 400).
7. Every required permission is **still** held at handoff time, not merely at approval (else 403).
8. `WorkflowService.createWorkflow` → `publishWorkflow` → `createRun`.
9. Compare-and-swap claim on the plan row.
10. Audit.

`createRun` — not `runWorkflow` — is the deliberate choice: the run is created `PENDING` and the workflow module's own queue and engine drive it. The AI module never calls `runWorkflow` or `runWorkflowStream`.

### Step translation

Each plan step becomes a `NOTIFICATION` step addressed to the requesting user, chained by `dependsOn`. This is deliberate: the handoff must not synthesise a business mutation the approver never saw, so the executed workflow *tells a human what to do* rather than doing it. Richer step types are a future extension that must go back through approval.

### Idempotency strategy

Three layers:
- **Generation** — unique `(tenant, user, planKey)`; regeneration refreshes an `awaiting_approval` plan and never rewinds a decided one.
- **Submission** — `findOrCreatePendingForResource` returns the approval already in flight.
- **Handoff** — `claimForHandoff` is a compare-and-swap on `status = APPROVED AND workflowExecutionId IS NULL`, plus a `workflowService` idempotency key of `ai-workflow-plan:<id>`. Of two concurrent handoffs only one creates a run; the loser replays the winner's identifiers.

## Expiration behaviour

Plans expire 24 h after generation. `list()` calls `expireOverdue()` before synchronising, so a stale plan is reported `expired` rather than actionable. Submission and handoff both re-check expiry and refuse.

## Assistant integration

`AssistantService.runStream` calls `AutonomousWorkflowPlansService.generateForAssistant(context, insights, decisions)` with the objects already assembled in that turn — context, insights and decisions are each built exactly once and nothing is recomputed. The structured plan set is forwarded verbatim into the existing agent runtime as a workspace-context block, alongside the insights, decisions and orchestration blocks. The prompt instructs the model to report each plan's status and approval id exactly, never to describe a plan as done, started or executed, and never to offer to run one.

Suggested prompts include "Create a plan for today's priorities." and "Build an executive action plan."

## Streaming events

`POST /api/v1/ai/workflow-plans/generate/stream` reuses the shared authenticated SSE transport.

| Event | Payload |
| --- | --- |
| `plan_started` | objective |
| `source_loaded` | source, decisionsConsidered |
| `step_generated` | planKey, order, title |
| `approval_submitted` | planId, approvalId, status |
| `plan_completed` | the full plan set |
| `plan_failed` | code, message |

No chain-of-thought or hidden reasoning is ever streamed — the planner is deterministic and has none. Cancellation and client disconnect are honoured via the transport's `AbortSignal`, checked between every phase. A failure emits a `plan_failed` event carrying a stable code and the exception message, never a stack trace.

## Dashboard

`/workflow-plans` renders plan title, objective, priority, risk, confidence, status, approval status, ordered steps, estimated duration, required roles and permissions, decision and insight evidence, context sources, approval identifier, workflow execution identifier when handed off, and created/expiry times.

Actions: refresh, generate, open details, submit for approval (when not yet submitted), cancel (where permitted), view approval, hand off approved plan. **There is deliberately no "Execute now" control** — the only path to execution is approval followed by handoff.

States: loading, error, empty, awaiting approval, approved, rejected, cancelled, expired, handed off and per-card handoff failure. Layout is responsive with `overflow-x-hidden` and `min-w-0` guards against mobile overflow; the details drawer is a real button with `aria-expanded`/`aria-controls`; badges carry `aria-label`; colours use theme tokens so dark mode follows automatically.

## Metrics

All on the shared registry, all with closed label sets.

| Metric | Labels |
| --- | --- |
| `voltx_workflow_plans_generated_total` | — |
| `voltx_workflow_plan_generation_duration_seconds` | — |
| `voltx_workflow_plan_approval_submissions_total` | `result` (success/failure/idempotent) |
| `voltx_workflow_plans_by_category_total` | `category` (7) |
| `voltx_workflow_plans_by_priority_total` | `priority` (4) |
| `voltx_workflow_plans_by_status_total` | `status` (6) |
| `voltx_workflow_plan_step_count` | — |
| `voltx_workflow_plan_handoff_attempts_total` | — |
| `voltx_workflow_plan_handoff_results_total` | `result` (2) |
| `voltx_workflow_plans_rejected_total` | — |
| `voltx_workflow_plans_expired_total` | — |

No tenant id, user id, plan id, approval id, workflow id, prompt text or organisation name is ever a label — asserted in test.

## Tenant isolation and permission model

- Endpoints use `AUTH_GUARDS` + `PermissionGuard` with `ai.agent.run`; **handoff additionally requires `ai.approval.decide`**, because starting approved work is a stronger act than asking for a plan.
- Plans inherit the context layer's permission filtering: a role that cannot read a source never sees its evidence.
- `AiWorkflowPlan` is registered in the central tenant extension and the repository scopes explicitly.
- A cross-tenant plan id returns 404 on read, submit and handoff, and the target plan is provably untouched.
- A role with no readable business source still receives the compliance decision about its own restricted visibility — a governance plan carrying no evidence.

## E2E coverage

`test/ai-workflow-plans.e2e-spec.ts` — 27 tests: 401 unauthenticated (generate and list), 401 malformed token, 403 missing permission, authorized generation and listing, approval created in the existing framework, payload carries no secrets, three-run determinism, tenant isolation both directions, cross-tenant read/submit/handoff refusal, a five-role permission matrix, executive-only governance-plan behaviour, the full approve→handoff lifecycle through real endpoints, duplicate submission and duplicate handoff idempotency, unapproved/rejected/cancelled/expired/version-mismatch refusals, non-execution assertions, and large-dataset bounding and tie-break stability.

Focused suites: `workflow-plan-engine.spec.ts` (21), `workflow-plan-approval-handoff.spec.ts` (27), `workflow-plan-assistant-stream.spec.ts` (17).

## Threat model

| Threat | Mitigation |
| --- | --- |
| Plan executed without approval | No execution path in the module; handoff requires `approved` status plus a live permission re-check |
| Approval bypass via regeneration | Regeneration never rewinds a decided plan; the plan key changes when the approved content changes, and handoff enforces the version |
| Double execution | Compare-and-swap claim plus a workflow idempotency key; proven by a run-count assertion |
| Cross-tenant plan access | Tenant Prisma extension + explicit repository scoping + 404 on foreign ids |
| Privilege escalation between approval and handoff | Required permissions re-verified at handoff, not trusted from approval time |
| Prompt injection in evidence | Evidence reaches the planner already sanitised by the context builder and is never interpreted; injected text provably changes no field |
| Secret leakage via approval payload | Payload carries identifiers and evidence references only; asserted in test |
| Stale approval acted on | 24 h expiry, re-checked at submit, handoff and listing; expiry outranks an actionable state |
| Metric cardinality explosion | Closed label sets only, asserted in test |

## Known limitations

1. **Translated steps are notifications only.** A handed-off workflow notifies humans; it does not perform the drafted action. Richer step types need their own approval design.
2. **Expiry is lazy**, evaluated on read rather than by a scheduled job. A plan that is never listed stays nominally un-expired in the table until touched, though every action path re-checks.
3. **`ai.agent.run` is reused** for generation rather than a dedicated `ai.workflow_plan.*` permission, consistent with the rest of the executive stack.
4. **Plans are per-user**, not per-tenant: two users generating the same plan get separate rows, because the plan key is scoped by user.
5. The dashboard's "view approval" link points at the existing operator inbox, which does not yet filter by a plan's approval id.
