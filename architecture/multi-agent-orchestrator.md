# Multi-Agent Orchestrator

The Multi-Agent Orchestrator (VT-204) coordinates eight specialized agents over one business objective. It is a **coordination layer, not a runtime**: it adds no provider calls, no prompt construction and no Prisma access. Every agent consumes the already-verified output of the Executive Context Engine, the Executive Insights Engine and the Executive Decision Engine, and every agent is deterministic.

## Architecture

```
User request
  → Executive Assistant (existing SSE conversation runtime)
    → OrchestratorService
      → Capability selection      (OrchestratorPolicy.route)
      → Permission validation     (OrchestratorPolicy.validate)
      → Context assembly          (ExecutiveContextService — cached, tenant-scoped)
      → Insights                  (ExecutiveInsightsService)
      → Decisions                 (ExecutiveDecisionsService)
      → Agent execution           (OrchestratorEngine.execute, parallel then sequential)
      → Merge + conflicts + consensus (OrchestratorEngine.merge)
      → Approval check            (recommendation.requiresApproval preserved verbatim)
      → Streaming response        (shared SSE transport)
      → Audit log                 (AuditService)
```

`OrchestratorEngine` and `OrchestratorPolicy` have no Prisma, HTTP or AI-provider dependency anywhere in their graph. `OrchestratorRegistry` imports only the decision and context **types**. This is asserted in test rather than left as a convention.

### Files

| File | Role |
| --- | --- |
| `orchestrator.types.ts` | `AgentInterface`, assessments, conflicts, consensus, merged result, SSE events |
| `orchestrator.registry.ts` | The eight agents and their precedence order |
| `orchestrator.policy.ts` | Routing table, permission validation, timeout/retry/breaker constants, circuit breaker |
| `orchestrator.engine.ts` | Execution policy, merge, conflict detection, consensus |
| `orchestrator.service.ts` | Pipeline orchestration, sanitisation, audit, metrics |
| `orchestrator.metrics.ts` | Thirteen collectors on the shared Prometheus registry |
| `orchestrator.controller.ts` | `POST /api/v1/ai/orchestrator/run` and `/run/stream` |
| `orchestrator.dto.ts` | Request validation and the Swagger response contract |
| `orchestrator.module.ts` | Wiring |

No repository and no persistence: the orchestration is a pure function of the current context, and the existing audit event provides traceability. Adding a table would create a second source of truth for something already reproducible.

## Routing model

Routing is a static term table (`CAPABILITY_TERMS`). The objective is lower-cased, stripped of punctuation, split on whitespace, bounded to 200 tokens, and matched **whole-word** — never as substrings, so "salesforce" does not match "sales". No model, embedding or ranking heuristic participates.

| Capability | Trigger terms (excerpt) | Agents |
| --- | --- | --- |
| `pipeline_analysis` | pipeline, deal(s), sales, opportunity/opportunities, quota | SalesAgent |
| `revenue_analysis` | revenue, finance, financial, invoice(s), cash, income | FinanceAgent |
| `budget_analysis` | budget(s), spend, spending, cost | FinanceAgent |
| `operations_analysis` | operations, operational, task(s), workflow(s), backlog | OperationsAgent |
| `communications_analysis` | communication(s), conversation(s), inbox, message | CommunicationsAgent |
| `customer_health_analysis` | customer(s), client(s), churn, escalation, support | CustomerSuccessAgent |
| `compliance_review` | compliance, governance, audit, policy, access, regulatory | ComplianceAgent |
| `executive_summary` | executive, business, company, overall, everything, priorities, today, risk(s), review, summarize, coordinate | ExecutiveAgent |
| `action_planning` | plan, planning, next, roadmap, sequence | PlanningAgent |

Three rules, reported on every response as `routing.rule`:

- **`term_match`** — one or more domain terms matched, no broad term. A narrow objective stays narrow: *"How is the sales pipeline?"* selects exactly `sales` + `planning`.
- **`term_match_broad_review`** — a broad term (`executive_summary`) matched. A request to review "the entire business" is a request for every domain, so the capability set expands to all nine. *"Review the entire business."* engages all eight agents.
- **`fallback_broad_review`** — nothing matched. Treated as a broad review so an unrecognised objective engages every agent rather than answering from the executive lens alone.

`action_planning` is always appended, so a multi-agent run is always sequenced.

## Agent registry

Registry order **is** conflict precedence order — earlier wins.

| # | Agent | Mode | Capabilities | Required permissions (any) | Context sources |
| --- | --- | --- | --- | --- | --- |
| 0 | ExecutiveAgent | parallel | `executive_summary` | `ai.agent.run` | crm, finance, operations, communications |
| 1 | SalesAgent | parallel | `pipeline_analysis` | `sales.opportunity.read`, `sales.lead.read` | crm |
| 2 | FinanceAgent | parallel | `revenue_analysis`, `budget_analysis` | `finance.transaction.read`, `finance.budget.read` | finance |
| 3 | OperationsAgent | parallel | `operations_analysis` | `sales.activity.read`, `workflow.read` | operations |
| 4 | CommunicationsAgent | parallel | `communications_analysis` | `communications.conversation.read` | communications |
| 5 | CustomerSuccessAgent | parallel | `customer_health_analysis` | `communications.conversation.read` | communications |
| 6 | ComplianceAgent | parallel | `compliance_review` | `ai.agent.run` | crm, finance, operations, communications |
| 7 | PlanningAgent | **sequential** | `action_planning` | `ai.agent.run` | crm, finance, operations, communications |

Domain agents report their categories' decisions verbatim — no rule is re-derived. Two agents apply a documented **lens**, which is where genuine disagreement comes from:

- **ExecutiveAgent** judges *concentration*: when one module produces more than one decision, that reads as systemic rather than incidental, so it raises those to `critical` and attributes them to `cross_domain`. It will disagree with the owning domain agent, and that disagreement is reported.
- **ComplianceAgent** owns compliance decisions and additionally reviews any decision carrying a permission limitation, where it recommends `review_access_scope` instead of the domain action — a deliberate recommendation conflict.
- **PlanningAgent** is the delegation edge: it runs after the parallel phase and reads the other agents' `AgentResult`s rather than the decision set.

## Execution lifecycle

1. **Parallel phase** — every eligible `mode: 'parallel'` agent runs under `Promise.all`. Results are re-sorted by agent id afterwards, so scheduler timing can never affect output.
2. **Sequential phase** — `mode: 'sequential'` agents run in registry order, each receiving all prior results as `upstream`.
3. Each execution passes through one shared policy in `OrchestratorEngine.execute`:

| Control | Value | Behaviour |
| --- | --- | --- |
| Timeout | `AGENT_TIMEOUT_MS` = 5 000 ms | Abandons the agent; **not** retried (a timeout is not transient) |
| Attempts | `AGENT_MAX_ATTEMPTS` = 2 | One initial call plus one retry, on non-timeout failure only |
| Circuit breaker | 3 consecutive failures | Opens for `CIRCUIT_COOLDOWN_MS` = 30 000 ms, then half-opens for one probe |
| Cancellation | `AbortSignal` | Propagates as `OrchestrationCancelledError` — never swallowed as a failure |

`execute` never throws for an agent failure. It returns a non-succeeded `AgentResult` carrying a `failureReason`, so the orchestration continues and the failure stays visible in the response and in `consensus.failedAgents`.

## Merge algorithm

Agent results are folded in **registry-precedence order**, so identical inputs always produce an identical merge.

1. Detect conflicts across all succeeded results (below).
2. For each recommendation, in precedence order:
   - if a recommendation conflict exists for its decision and this agent is not the winner → **rejected**, with the superseding agent named;
   - if the caller lacks any `requiredPermissions` → **excluded**, with the missing permissions listed;
   - if `decisionId:code` was already taken → de-duplicated;
   - otherwise kept.
3. Sort recommendations by `decisionId`, then `code`.
4. Union evidence, de-duplicate by record id, rank by priority then id, cap at 20 (each agent caps at 5).
5. Roll up: highest priority, highest business impact, **weakest** confidence, `approvalRequired` = any surviving recommendation requires approval.

Rejected and excluded recommendations are returned in full on `consensus`. Nothing is silently dropped.

## Conflict model

For every decision assessed by two or more agents, each pair is compared on six dimensions:

| Type | Fires when |
| --- | --- |
| `priority` | Agents assigned different priority |
| `recommendation` | Agents proposed different action codes |
| `confidence` | Agents reported different confidence |
| `evidence` | Agents cited different evidence sets |
| `permissions` | Agents require different permissions to act |
| `affected_module` | Agents attribute the decision to different modules |

Each conflict carries `agentIds`, a human-readable `detail`, `resolvedInFavourOf` and `resolutionReason`. Conflicts are sorted by id. **Resolution is a merge preference, not a deletion** — the losing recommendation appears under `rejectedRecommendations`.

## Consensus algorithm

Deterministic, no voting and no model:

```
contested   = decisions assessed by ≥ 2 succeeded agents
agreed      = contested decisions where every assessing agent reported
              the same priority AND the same recommendation code
agreementScore = contested == 0 ? 1 : round(agreed / contested, 4)
```

A decision only one agent assessed is not contested and is excluded from the denominator. With no contested decisions the score is `1` and `sharedAssessments` is `0`; the `explanation` string states this in words rather than implying unanimity. Consensus also reports the confidence distribution, participating agents, skipped agents with reasons, failed agents with reasons, and both rejected and excluded recommendations.

## Failure handling

| Condition | Result |
| --- | --- |
| Agent timeout | `timed_out`, reason recorded, orchestration continues |
| Agent failure | Retried once, then `failed` with the error message |
| Retry exhaustion | `failed`, `attempts` reported |
| Circuit open | `circuit_open`, agent skipped without running |
| Permission denial | `skipped_permission` — reason names no permission key |
| Unavailable / empty context | `skipped_no_context`, or agents run and return empty output |
| Conflicting results | Reported in `conflicts`, never silently resolved |
| Partial execution | `partialFailure: true` on the response |
| Cancellation | Propagates; no partial result is returned as if complete |

## Security model

- **Authentication / RBAC** — `AUTH_GUARDS` + `PermissionGuard` with `ai.agent.run`, matching `/ai/context`, `/ai/insights` and `/ai/decisions`.
- **Tenant isolation** — inherited unchanged: `TenantMiddleware` → `TenantContextService` → the tenant Prisma extension. The orchestrator holds no client of its own, so there is no path by which it could reach another tenant.
- **Permission filtering** — twice: the context layer filters sources, then `OrchestratorPolicy.validate` filters agents, then the merge filters recommendations the caller cannot carry out.
- **Prompt sanitisation** — the objective is length-bounded to 2 000 characters (rejected at 400 beyond that), stripped of control characters and whitespace-collapsed before it is tokenised, echoed or forwarded. Routing reads only whole-word tokens, so injected instructions cannot select an agent or grant an action.
- **No automatic execution** — `AgentRecommendation.executes` is the literal type `false`; the orchestrator has no execution path to call.
- **Audit** — one `orchestrate` / `ai_orchestration` event per run, recording agent count, conflict count, agreement score and partial-failure state. No objective text and no record values.

## Metrics

Thirteen collectors on the shared registry. Every label is a closed set — agent ids from the static registry, statuses and modes from their type unions, consensus bucketed onto five fixed values.

| Metric | Labels |
| --- | --- |
| `voltx_orchestrator_requests_total` | `result` (2) |
| `voltx_orchestrator_duration_seconds` | — |
| `voltx_orchestrator_agent_executions_total` | `agent` (8), `status` (6) |
| `voltx_orchestrator_agent_duration_seconds` | `agent` (8) |
| `voltx_orchestrator_executions_by_mode_total` | `mode` (2) |
| `voltx_orchestrator_consensus_total` | `bucket` (5) |
| `voltx_orchestrator_conflicts_total` | `type` (6) |
| `voltx_orchestrator_merge_duration_seconds` | — |
| `voltx_orchestrator_partial_failures_total` | — |
| `voltx_orchestrator_agent_timeouts_total` | `agent` (8) |
| `voltx_orchestrator_agent_retries_total` | `agent` (8) |
| `voltx_orchestrator_circuit_open_total` | `agent` (8) |
| `voltx_orchestrator_agent_confidence_total` | `confidence` (3) |

No tenant id, user id, objective text, decision id or record value is ever a label.

## Testing

| Suite | Tests | Covers |
| --- | --- | --- |
| `test/orchestrator.spec.ts` | 50 | Registry contract, routing (incl. whole-word and broad expansion), permission validation, retry, timeout, circuit breaker, cancellation, merge, all six conflict types, consensus, approval preservation, metric label hygiene |
| `test/assistant-orchestrator-integration.spec.ts` | 11 | Assistant delegates to the orchestrator, reuses the existing runtime, carries conflicts and consensus, preserves approval flags, cross-turn determinism |
| `test/ai-orchestrator.e2e-spec.ts` | 36 | 401/403/400, authorized contract, routing matrix, single/parallel/sequential, tenant isolation, permission matrix, conflicts, consensus, injection inertness, 3-run determinism, large datasets |

## Threat model

| Threat | Mitigation |
| --- | --- |
| Prompt injection in the objective | Whole-word term routing; no model reads the objective to choose agents; sanitised and length-bounded before use |
| Prompt injection in business records | Records reach agents only as context evidence, already sanitised by `ExecutiveContextBuilder.cleanLabel`; agents never interpret record text |
| Cross-tenant leakage | Orchestrator holds no DB client; all data arrives through the tenant-scoped context cache keyed by organisation, user and permission fingerprint |
| Privilege escalation via recommendation | Recommendations the caller cannot perform are excluded at merge with the missing permissions named |
| Unauthorised state change | No execution path exists; `executes` is structurally `false` and `requiresApproval` is carried verbatim from the Decision Engine |
| Denial of service via agent hang | 5 s per-agent timeout, 2-attempt cap, circuit breaker |
| Metric cardinality explosion | Closed label sets only, asserted in test |
| Information disclosure via skip reasons | Skip reasons name no permission key — asserted in E2E |

## Future agent extension guide

1. Implement `AgentInterface` in `orchestrator.registry.ts`. Consume only `input.context`, `input.insights`, `input.decisions` and `input.upstream` — never a repository or Prisma client.
2. Declare `supportedCapabilities`, `requiredPermissions` and `supportedContextSources` honestly; the policy uses them to skip the agent safely.
3. Add the capability and its trigger terms to `CAPABILITY_TERMS`. Terms must be whole words a user would actually type.
4. Insert the agent at the position in `ORCHESTRATOR_AGENTS` that reflects its **conflict precedence** — this is the only thing registry order controls.
5. Choose `mode`. Use `sequential` only if the agent needs upstream results.
6. If the agent applies a lens that can disagree with a domain agent, document it here; the conflict machinery needs no change.
7. Extend the capability-coverage and routing tests in `test/orchestrator.spec.ts`. Metrics need no change — `agent` labels come from the registry.

Agents must never re-derive insight or decision rules. If a new business rule is needed, it belongs in the Decision Engine, and the agent consumes the result.
