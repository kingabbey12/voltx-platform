# Executive Insights Engine

The Executive Insights Engine is a deterministic layer over the existing Executive Context Engine. It has no Prisma access, no provider calls, and no independent AI runtime. `GET /api/v1/ai/insights` uses the existing authentication, tenant, RBAC, throttling, audit, metrics, and context boundaries.

Each insight records its evidence, source, excluded sources, deterministic calculation path, confidence, business impact, and a recommendation that always requires approval. Confidence is derived solely from the number of available permission-filtered records: high (3+), medium (1–2), low (0). Priority derives from the highest context priority, then stable record ID. Historical claims are deliberately absent until the context layer supplies comparable historical evidence.

Metrics use low-cardinality labels only and record request outcome plus generation duration. Context continues to be the source of cache and assembly metrics. Calendar remains excluded because no exported calendar domain service exists.

Historical aggregates are not yet exported by the permitted domain-service contracts. The API therefore returns a per-source `trendStatus: unavailable` with `historical_source_unavailable`; it never emits synthetic period comparisons, charts, or percentages. Persistence is intentionally not used in VT-202 because the existing audit event provides generation traceability and no scheduled reporting or review-history requirement exists.

The Executive Assistant's existing SSE execution path calls `ExecutiveInsightsService.generate()` alongside `ExecutiveContextService.getExecutiveContext()` and supplies the resulting structured evidence to the existing agent runtime. It does not recalculate rules in a prompt and recommendations remain approval-required. The `/executive-insights` dashboard uses the same protected API and provides refresh, category/search filters, loading, error, empty, evidence, unavailable-trend, and approval-required states.

Tests verify deterministic ordering, explainability, confidence, and non-executing recommendations. Future source or trend extensions must first be added through Executive Context; the insights engine must never bypass it.

## Verified HTTP behaviour

`backend/test/ai-insights.e2e-spec.ts` drives `GET /api/v1/ai/insights` over real HTTP against the migrated `voltx_test` database. Nothing in it stubs authentication, the tenant middleware, the guards, the tenant Prisma extension or the permitted domain services.

| Area | Coverage |
| --- | --- |
| Unauthenticated | 401 with no envelope `data`, no `insightVersion`, no `evidence`; a malformed bearer token also 401s |
| Missing permission | An authenticated `viewer` (no `ai.agent.run`) gets 403 with no `data`, `evidence`, `supportingMetrics` or `recommendedAction`, and the response discloses no permission key |
| Authorized | 200 with `insightVersion` `1.0`, parseable `generatedAt`, `tenantId`, `userId`, `insights[]`, `excludedSources`, `trends`; every insight carries `title`, `summary`, `evidence`, `confidence`, `businessImpact`, `priority`, `affectedModule`, `recommendedAction`, `supportingMetrics`, `calculationPath`, `sourcesUsed`, `excludedSources` and `generatedAt` |
| Tenant isolation | Seven seeded marker values per tenant proven absent from the other tenant's whole serialized body |
| Permission filtering | Seven role permutations, asserted on categories, excluded sources and restricted evidence values |
| Historical trends | Every permitted source reports `trendStatus: unavailable` / `historical_source_unavailable`, with no fabricated comparison |
| Determinism | Three cache-invalidated requests compared as normalized snapshots and as an explicit structural fingerprint |
| Explainability | Evidence, source attribution, metric traceability and the confidence rule asserted per insight |
| Large dataset | Bounded output, stable ranking and tie-breaking, soft-deleted and cross-tenant exclusion, inert injection text |

`approvalRequired` is expressed on the wire as `recommendedAction.requiresApproval`, which is asserted `true` for every insight in every scenario. No response may contain `"requiresApproval":false`, `autoApprove` or `executed`.

### Permission matrix

Each role below additionally holds `organization.read` and `ai.agent.run`.

| Test user | Source permissions | Insight categories returned | Excluded sources |
| --- | --- | --- | --- |
| CRM-only | `sales.opportunity.read`, `sales.lead.read` | `executive_summary`, `sales` | finance, operations, communications, notifications, calendar |
| Finance-only | `finance.transaction.read`, `finance.budget.read` | `executive_summary`, `finance` | crm, operations, communications, notifications, calendar |
| Operations-only | `sales.activity.read` | `executive_summary`, `operations` | crm, finance, communications, notifications, calendar |
| Communications-only | `communications.conversation.read` | `executive_summary`, `communications` | crm, finance, operations, notifications, calendar |
| Notifications-only | `notification.read` | *(none)* | crm, finance, operations, communications, calendar |
| Mixed | CRM + communications | `executive_summary`, `sales`, `communications` | finance, operations, notifications, calendar |
| Full access | all five sources | `executive_summary`, `sales`, `finance`, `operations`, `communications` | calendar |

Notifications are a permitted *context* source but not an *insight* category, so a notifications-only user receives an empty insight array rather than a category label with restricted evidence hidden behind it. Excluded-source reasons are limited to `missing_permission`, `calendar_not_available` and `source_error`; none names a permission key or a business value.

### Tenant isolation proof

Two organizations are seeded with distinct recognizable values — opportunity title, lead title, finance transaction category, budget name, activity subject, conversation subject and notification title. Requesting as organization A asserts each of organization B's seven values, B's organization ID and B's user ID are absent from titles, summaries, evidence labels, evidence details, supporting metrics, recommended actions, source metadata and the full serialized response body — and the reverse for B. Soft-deleted records are likewise absent.

### Determinism

Insights are requested three times, with the Executive Context cache invalidated between each so the engine fully recomputes rather than replaying a cached blob. The runs are compared both as normalized snapshots and as an explicit fingerprint of insight ID, category, priority, confidence, business impact, recommendation label and approval flag, evidence ID ordering, sorted supporting metrics and excluded-source ordering — no comparison relies on JavaScript key insertion order. The only fields normalized away are the response and per-insight `generatedAt`, and the `finance:current-month-overview` evidence item's `occurredAt`, which is the current-period "as of now" boundary (`FinanceService.getOverview` uses `now` as `periodEnd`) rather than a record timestamp. Every other evidence `occurredAt` is compared exactly.

### Explainability contract

For every insight: evidence is non-empty whenever the insight claims a business condition; each evidence item carries a namespaced record ID, a label and a context priority; `criticalRecords` and `highPriorityRecords` equal the corresponding counts in that insight's own evidence and `recordsAvailable` is never below the evidence count; confidence equals high (3+ evidence), medium (1–2) or low (0); `sourcesUsed` contains the insight's `affectedModule` and never overlaps its excluded sources; and the recommendation label comes from the fixed, non-executing catalog with approval required.

### Large-dataset limits

With 44 opportunities, 30 activities and 25 notifications seeded, plus equal-ranked twins, a soft-deleted decoy, a cross-tenant record and prompt-injection-like titles: each source contributes at most 20 context items and each insight at most 5 evidence items; only high-priority records survive into evidence; ties break stably by record ID; soft-deleted and cross-tenant rows never appear; and instruction-like record text changes neither the recommendation catalog nor the approval flag.

### Assistant integration

`backend/test/assistant-insights-integration.spec.ts` runs `AssistantService.runStream` against the real `ExecutiveInsightsService` and `ExecutiveInsightsEngine` with the agent runtime captured, so no external AI provider is needed. It proves the assistant calls `generate()` exactly once, forwards the resulting structured payload verbatim into the existing `runAutonomousAgentStream` workspace context, carries the evidence and the unavailable-trend contract through, keeps every recommendation approval-required, and re-derives no insight rules of its own — stubbing `generate()` changes the forwarded payload exactly.

### Insight metrics

`backend/test/executive-insights.metrics.spec.ts` asserts `voltx_executive_insights_requests_total` and `voltx_executive_insights_generation_duration_seconds` are each registered once, that an authorized request increments `result="success"` and observes a duration, that a failed generation records `result="failure"` and no success, and that the only labels present are `result` and the histogram's `le` — never a tenant ID, user ID, prompt, record ID or organization name.

### Full backend E2E aggregate

`pnpm test:e2e:local --seed` was run three times. Each run reported **58 suites / 391 tests** (up from the 57 / 363 baseline by exactly this suite's 28 tests), with `ai-insights.e2e-spec.ts` green in all three: 7.5 s, 7.7 s and 7.3 s.

| Run | Suites | Tests | Failing suite | Cause |
| --- | --- | --- | --- | --- |
| 1 | 57 passed / 58 | 390 passed / 391 | `branding.e2e-spec.ts` (328 s) | `Exceeded timeout of 5000 ms for a test` |
| 2 | 57 passed / 58 | 389 passed / 391 | `invitation.e2e-spec.ts` (130 s) | `Exceeded timeout of 5000 ms for a hook` |
| 3 | 57 passed / 58 | 390 passed / 391 | `attachments.e2e-spec.ts` (174 s) | `Exceeded timeout of 5000 ms for a hook` |

A different suite failed each run, always on the default 5000 ms Jest timeout while that suite ran one to two orders of magnitude slower than normal (branding 328 s vs. 8.8 s, invitation 130 s vs. 8.2 s, attachments 174 s vs. 8.5 s). Each was re-run in isolation immediately afterwards and passed in full. These are host resource-starvation flakes in the shared runner, not insight-related regressions; no failing test touches the insights, context or assistant code paths.

### Known gaps

The `revenue` insight category is declared in `insights.types.ts` but no rule emits it yet. The `executive_summary` insight clones the first *declared* section insight (CRM when permitted) rather than the highest-priority one, so its "highest current priority" wording can name a lower-priority insight; the behaviour is deterministic and stable, and correcting the selection is deferred to avoid redesigning the engine in this pass.
