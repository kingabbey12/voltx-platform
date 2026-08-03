# Executive Decision Engine

The Decision Engine is the third deterministic layer in the executive stack. It converts verified Executive Insights into a prioritized, explainable queue of business decisions. It recommends; it never executes.

## Architecture

```
domain services ──► Executive Context Engine ──► Executive Insights Engine ──► Decision Engine
   (RBAC-filtered)      (tenant-scoped,             (deterministic rules,        (deterministic rules,
                         permission-filtered)        evidence-attributed)         recommendation-only)
```

`GET /api/v1/ai/decisions` reuses the existing authentication, tenant middleware, RBAC guards, throttling, audit and metrics boundaries — the same `AUTH_GUARDS` + `PermissionGuard` composition and the same `ai.agent.run` permission as `/ai/context` and `/ai/insights`.

The module is seven files under `backend/src/modules/ai/decision/` and no repository: nothing is persisted, because the existing audit event already provides generation traceability and no scheduled reporting or decision-history requirement exists yet.

- `decision.types.ts` — the wire contract.
- `decision.rules.ts` — the rule catalog and every derivation.
- `decision.engine.ts` — pure assembly and aggregation.
- `decision.service.ts` — orchestration, audit, metrics.
- `decision.controller.ts` — the single protected GET route.
- `decision.dto.ts` / `decision.module.ts` — Swagger contract and wiring.

**No raw database access.** `ExecutiveDecisionEngine` and `ExecutiveDecisionRules` have no Prisma client, HTTP client or AI provider anywhere in their dependency graph. `ExecutiveDecisionsService` holds exactly five collaborators — context service, insights service, engine, audit, metrics — and reads data only through the first two. This is asserted in `executive-decision.integration.spec.ts`.

**No second AI runtime.** The engine performs no model calls at all. Every value it emits — priority, confidence, risk, urgency, business impact, recommendation — comes from the rule catalog. The Executive Assistant continues to use the one existing agent runtime.

## Decision pipeline

1. The controller resolves the caller's permissions from `UserContextGuard`.
2. `ExecutiveDecisionsService.generate` requests the Executive Context and the Executive Insights in parallel. Both resolve against the same tenant-scoped, permission-filtered context; the second is served from the 30-second context cache rather than re-querying any domain service.
3. `ExecutiveDecisionEngine.build` runs the rule catalog in sorted rule-id order, materializes each match, then sorts the result.
4. The service records one audit event and the six decision metrics.

The Assistant path skips step 2: `generateFrom(context, insights)` accepts the objects the assistant already assembled, so one assistant turn builds context once and runs each rule set once.

## Rule model

A rule is `{ id, version, category, evaluate(input) }` where `input` is `{ context, insights }`. `evaluate` returns a draft or `null`. Rules never mutate their input and never read outside it.

| Rule id | Category | Fires when | Recommendation | Approval |
| --- | --- | --- | --- | --- |
| `sales.pipeline-attention` | sales | The sales insight has ≥1 critical or high record | Review and follow up on the flagged deals | required |
| `sales.pipeline-stalled` | sales | The sales insight has evidence but no flagged record | Schedule a sales pipeline review | required |
| `finance.exception-review` | finance | The finance insight has ≥1 flagged record | Review the flagged finance records | required |
| `finance.budget-review` | finance | Verified budget utilisation ≥ 80% | Review budget utilisation before further commitments | required |
| `operations.blocking-work` | operations | The operations insight has ≥1 flagged record | Investigate and unblock the flagged work | required |
| `operations.backlog-review` | operations | ≥5 open operational records | Schedule an operations backlog review | required |
| `communications.priority-review` | communications | The communications insight has evidence | Follow up on waiting customer conversations | required |
| `customer_success.escalation-intervention` | customer_success | ≥1 conversation is a critical escalation | Assign a support intervention | required |
| `risk.critical-exposure` | risk | Any non-summary insight is critical | Escalate the critical areas for executive review | required |
| `executive.top-priority` | executive_priority | An executive summary insight exists | Review the highest-priority item first | not required |
| `compliance.restricted-visibility` | compliance | ≥1 source excluded for `missing_permission` | Review whether the role should see the excluded sources | required |

Thresholds are named constants in `decision.rules.ts` (`BUDGET_WARNING_RATIO` 0.8, `BUDGET_BREACH_RATIO` 1.0, `OPERATIONS_BACKLOG_THRESHOLD` 5, `MAX_DECISION_EVIDENCE` 5), not literals scattered through the rules.

Every rule id is unique, versioned `1.0`, and appears in `rulesEvaluated` on every response whether it matched or not — so the absence of a decision is as visible as its presence.

## Priority algorithm

```
derived  = max(priority) over the insights the rule used     (low when it used none)
priority = max(derived, rule.priorityFloor)
```

`risk.critical-exposure` and `customer_success.escalation-intervention` floor at `critical`; `finance.budget-review` floors at `high`, or `critical` once the budget is breached. Urgency is a pure function of priority: `critical → immediate`, `high → this_week`, `medium → this_month`, `low → monitor`. Business impact is the maximum insight `businessImpact`, raised to `critical` when the decision itself is critical.

Ordering is priority descending, then risk descending, then rule id ascending — total and stable, with no reliance on object key insertion order.

## Confidence algorithm

Confidence is **the weakest confidence among the insights the rule relied on**, never an average and never model-generated. A rule that used no insight (`compliance.restricted-visibility`) reports `medium` when it carries evidence and `low` when it does not. `confidenceReason` states the level, the number of source insights and the evidence count behind it.

This deliberately does not recompute the insight-level confidence rule; it consumes the value the Insights Engine already derived.

## Risk algorithm

```
critical  if any used insight has criticalRecords > 0
high      else if any used insight has highPriorityRecords > 0
medium    else if the decision carries any evidence
low       otherwise
```

then raised by any `riskFloor`. Risk is derived only from verified context counts already present on the insight — there is no external risk signal, score or model.

## Approval model

Every decision carries `approvalRequired` and a `recommendedAction` whose `executes` field is the literal `false`. The recommendation vocabulary (`review`, `investigate`, `escalate`, `schedule`, `assign`, `approve`, `follow_up`) contains no operation this engine can perform, so "recommend, never execute" is a property of the type rather than of a code path someone must remember not to add.

`approvalRequired` is `true` for every business-changing recommendation. The single exception is `executive.top-priority`, a briefing that changes no state; reading a ranked list needs no approval. Anything a user acts on continues to flow through the existing approval framework — the Decision Engine neither creates nor decides approvals.

## Explainability

Every decision exposes, at the top level and mirrored inside `explainability`: `insightIdsUsed`, `contextSourcesUsed`, `excludedSources`, `evidence`, `supportingMetrics`, `ruleId`, `ruleVersion`, `priorityReason`, `confidenceReason`, `riskReason` and `permissionLimitations`. The decision id is `decision:<ruleId>`, so a queue entry names the rule that produced it.

`permissionLimitations` are safe, generic sentences of the form *"The finance source was excluded because the role cannot read it."* — they name the source, never the permission key the caller lacks.

## Metrics

All six use fixed, low-cardinality label sets. No tenant id, user id, organization name, record id or prompt is ever a label.

| Metric | Labels | Cardinality |
| --- | --- | --- |
| `voltx_executive_decisions_requests_total` | `result` | 2 |
| `voltx_executive_decisions_generation_duration_seconds` | `le` (histogram) | 8 buckets |
| `voltx_executive_decisions_category_total` | `category` | 8 |
| `voltx_executive_decisions_priority_total` | `priority` | 4 |
| `voltx_executive_decisions_approval_required_total` | `approval_required` | 2 |
| `voltx_executive_decision_rule_matches_total` | `rule` | 11 (the static catalog) |

## Assistant integration

`AssistantService.runStream` calls `ExecutiveDecisionsService.generateFrom` with the context and insights it already holds, and appends the decision payload to the existing `workspaceContext` alongside the context and insight blocks. The prompt instructs the model to answer *"what should I do today"*, *"what is my highest priority"*, *"what should I review first"* and *"what business risk needs attention"* strictly from the ranked list, and never to invent, re-rank or execute anything. Those four questions are the assistant's suggested prompts.

The rules themselves are never restated in the prompt — the rule identity travels as data (`ruleId`, `ruleVersion`) so the model reports which rule fired without being able to re-derive or override it.

## Dashboard

`/executive-decisions` (`apps/web/src/app/(app)/(shell)/executive-decisions/page.tsx`) renders a priority queue with clickable counts, decision cards with priority/risk/confidence/urgency/approval badges and supporting metrics, an evidence drawer showing evidence, the three reason strings, rule identity, insights used, context sources, required permissions and visibility limits. It has category and priority filters, free-text search, manual refresh, a 60-second refresh interval plus refetch on focus, and distinct loading (skeletons), error (`role="alert"` + retry), and two empty states — "nothing available from the sources you can read" versus "nothing matches your filters". The drawer is a labelled `role="dialog"` closable by button, backdrop or Escape; every control has an accessible name; colours come from the shared token set, so dark mode and the responsive grid follow the rest of the shell.

## Threat model

| Threat | Control |
| --- | --- |
| Cross-tenant decision leakage | Decisions can only contain what the Executive Context Engine returned, which is scoped by `TenantMiddleware` + the tenant Prisma extension + `TenantGuard`. Proven with per-tenant marker values asserted absent from the other tenant's whole response body. |
| Privilege escalation via decisions | Sources the caller cannot read never enter the context, so no rule can see them. Asserted per permission permutation: every `contextSourcesUsed` value is checked against the excluded-source list. |
| Prompt injection through business records | Record text is only ever evidence data. Titles, summaries and recommendation labels come from the rule catalog, never from record content, so injected instructions cannot change the recommendation. Verified with injection-shaped records at normal and high volume. |
| Silent auto-execution | `executes` is the literal `false`; the action vocabulary contains no executable operation; the response is asserted to contain no `executeUrl`, `callbackUrl`, `webhook`, `mutation`, `jobId`, `autoApprove` or `autoExecute`. |
| Fabricated evidence or recommendations | Every evidence id is asserted to exist in the insight layer's evidence; every action code is asserted to belong to the closed catalog. |
| Metric cardinality explosion / PII in metrics | Label names and values are asserted against fixed allow-lists, and metric lines are asserted not to contain tenant ids, user ids, record ids or record labels. |
| Unaudited generation | Every generation records one audit event scoped to the tenant, carrying only `decisionCount` and `approvalRequiredCount`. |

## Testing

| Layer | File | Tests |
| --- | --- | --- |
| Unit | `test/executive-decision.rules.spec.ts` | 22 |
| Integration | `test/executive-decision.integration.spec.ts` | 18 |
| HTTP E2E | `test/ai-decisions.e2e-spec.ts` | 30 |

The unit suite feeds the **real** Executive Insights rules rather than synthetic insights, so a change to the insight contract fails here rather than silently passing. The E2E suite covers 401, malformed-token 401, 403, the authorized contract, urgency mapping, non-execution, absence of execution handles, explainability, insight/evidence traceability, tenant isolation both directions, soft-delete exclusion, a seven-role permission matrix, safe permission language, three-request determinism with cache invalidation between runs, ordering, prompt-injection inertness, and large-dataset bounding, ranking, tie-breaking and approval preservation.

## Future extensions

- Persist decision snapshots once decision history or scheduled executive reporting is required; the current audit event covers traceability only.
- Add trend-aware rules once the Executive Context Engine exposes verified historical aggregates. Until then decisions describe current state only, consistent with the insights layer's `historical_source_unavailable` contract.
- Add a `notifications`-derived decision category once notifications become an insight category; today a notifications-only role receives only the compliance decision.
- Wire decision recommendations to pre-filled approval requests in the existing approval framework, so a user can raise the approval from the card without the engine ever creating one itself.
- New sources must be added through Executive Context, then Executive Insights, then here. The Decision Engine must never bypass either layer.
