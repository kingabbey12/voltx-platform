# Business Intelligence Engine

Deterministic executive and department health scoring derived entirely from the verified Executive Context. There is no model in the scoring path: the same context always produces the same scores, and every deduction is explained by a record the caller is permitted to see. It does not query operational tables, call an AI provider, predict future outcomes, or replace Executive Context, Insights, Decisions or Workflow Planning.

## Architecture

```
Domain services (sales, finance, workflows, comms, notifications)
        ↓  permission-filtered, tenant-scoped
Executive Context Engine
        ↓  ExecutiveContext
Business Intelligence Engine        (pure, synchronous, no Prisma)
        ↓  BusinessIntelligenceResult
HTTP  /api/v1/business-intelligence      Assistant       Dashboard
```

Request path: `authenticated request → RBAC/tenant guards → Executive Context → pure BI engine → audit log → response`.

`business-intelligence.engine.ts` has no Prisma client, no HTTP client and no AI provider in its dependency graph. The service layer adds audit and metrics; the controller adds auth, RBAC and the response envelope.

## Formula Version 1.0

**Unchanged in this pass.** Per source section:

```
sourceScore = max(0, 100 − 25 × criticalRecords − 10 × highPriorityRecords)
```

A department score averages its required sources and rounds. Executive Health is the rounded arithmetic mean of the *available* department scores only.

| Weight | Value |
| --- | --- |
| `criticalRecord` | −25 |
| `highPriorityRecord` | −10 |
| Floor | 0 (`max(0, …)`) |
| Ceiling | 100 |

Status thresholds: `≥ 80 healthy`, `≥ 60 watch`, else `at_risk`. A source that is permission-limited or unavailable yields `score: null`, `status: "unavailable"` — never a fabricated number. Executive Health is unavailable when no department is available.

Historical trends are deliberately unsupported: every score returns `trendStatus: "unavailable"` with `trendReason: "historical_source_unavailable"`. No period comparison, percentage, arrow or chart is ever emitted.

Future formula changes must introduce a new version alongside tests and an explicit migration note; version `1.0` remains reproducible.

## Department mapping

| Score id | Category | Required context source |
| --- | --- | --- |
| `executive_health` | executive | every available department's sources |
| `financial_health` | financial | `finance` |
| `sales_health` | sales | `crm` |
| `operations_health` | operations | `operations` |
| `customer_success_health` | customer_success | `communications` |
| `communications_health` | communications | `communications` |
| `compliance_health` | compliance | `notifications` |

## Operations severity contract

The production contract BI scores against, pinned in `test/operations-context-severity.spec.ts`:

| Operations record | Priority | Deduction |
| --- | --- | --- |
| Open activity, no due date | `medium` | none |
| Open activity, future due date | `medium` | none |
| Open activity, **overdue** | `high` | −10 |
| Completed activity | *never collected* — the provider queries `completed: false` | — |
| Successful workflow run | *never collected* — the provider queries `status: FAILED` | — |
| **Failed workflow run** | `critical` | −25 |
| Pending workflow approval | `high` | −10 |

An overdue activity is **high, not critical**. A `critical` operations deduction can only come from a genuine failed workflow run, so any test wanting one must build the real graph:

```
Workflow → WorkflowVersion → Conversation → WorkflowRun (FAILED)
```

which then flows Workflow Provider → Operations Context → Executive Context → Business Intelligence with no mocked severity and no manual injection.

## HTTP contract

| Method | Path | Permission | Returns |
| --- | --- | --- | --- |
| GET | `/api/v1/business-intelligence` | `ai.agent.run` | full result |
| GET | `/api/v1/business-intelligence/health` | `ai.agent.run` | executive health only |
| GET | `/api/v1/business-intelligence/departments` | `ai.agent.run` | department scores |
| GET | `/api/v1/business-intelligence/scores` | `ai.agent.run` | full result |
| GET | `/api/v1/business-intelligence/explain/:scoreId` | `ai.agent.run` | one score, or 404 |

Every score carries `formula`, `formulaVersion`, `weights`, `inputs`, `evidence`, `sourceModules`, `excludedSources`, `reasoning`, `confidence`, `generatedAt`, `trendStatus` and `trendReason`. The explain endpoint rejects unknown score ids with a 404 that leaks no internals.

## Formula verification (through HTTP)

Proven end-to-end in `test/business-intelligence.e2e-spec.ts` against real seeded records:

| Scenario | Records | Score |
| --- | --- | --- |
| No deductions | future-dated open activity | **100** |
| One high | one overdue open activity | **90** |
| One critical | one FAILED workflow run | **75** |
| One critical + one high | FAILED run + overdue activity | **65** |
| Floor | four FAILED runs + one overdue activity | **0** |

Each assertion additionally proves the score is finite, non-negative and `formulaVersion` is `1.0`, and — via `assertWellFormed` — that the score equals exactly `max(0, 100 − 25c − 10h)` recomputed from the returned evidence. That rules out hidden deductions and fabricated evidence in both directions.

## Metrics

Recorded by `BusinessIntelligenceService` on the shared registry, fixed-vocabulary labels only: request result, score category, score status, formula version and historical-unavailable reason.

- `recordBusinessIntelligence(result, durationMs)` — request outcome and duration
- `recordBusinessIntelligenceScore(category, status, formulaVersion, trendReason)`
- `recordBusinessIntelligenceExplain(result)`

No metric label can contain tenant, user, record, organisation, evidence or prompt data. `test/business-intelligence.metrics.spec.ts` verifies registration and fixed-label exposition for all seven collectors.

## Dashboard

`/executive/business-intelligence`

Widgets: Executive Health card, six department health cards (sales, finance, operations, communications, customer success, compliance), executive summary line, evidence drawer (formula, weights, reasoning, confidence, inputs, evidence, excluded sources), unavailable-history banner, refresh, retry, loading, error and empty states.

The dashboard **consumes `GET /business-intelligence` only** and performs no calculation: every number, status, formula string and reason is rendered as received. Search is local over the already-cached response — departments, evidence labels, formulas, reasoning, sources and input keys — with no search endpoint and no extra request.

Status and priority chips use the shared `Badge` design-system variants rather than hand-rolled tints, which is what resolved the initial Axe contrast failure.

## Assistant integration

The Assistant assembles Executive Context once per turn and passes that exact object to `BusinessIntelligenceService` once. The structured BI payload is forwarded verbatim as evidence-only context into the existing agent runtime, alongside insights, decisions, orchestration and workflow plans. The Assistant never recalculates a score, never turns a score into an execution instruction, and never displaces Decisions/Workflow Planning ownership of recommendations.

## Permission matrix

Scores appear only for sources the role can read; everything else is explicitly `unavailable`.

| Role | Available scores | Unavailable |
| --- | --- | --- |
| CRM-only | sales, executive | financial, operations, communications, customer_success, compliance |
| Finance-only | financial, executive | sales, operations, communications, customer_success, compliance |
| Operations-only | operations, executive | sales, financial, communications, customer_success, compliance |
| Communications-only | communications, customer_success, executive | sales, financial, operations, compliance |
| CRM + Communications | sales, communications, customer_success, executive | financial, operations, compliance |
| Finance + Operations | financial, operations, executive | sales, communications, customer_success, compliance |
| CRM + Finance + Communications | sales, financial, communications, customer_success, executive | operations, compliance |
| No BI source | none — Executive Health is `unavailable` | all |

Executive Health averages only the available departments, so a restricted role gets a smaller but honest average rather than a diluted one.

## Tenant isolation

Every read flows through the tenant Prisma extension and the tenant-scoped Executive Context. The E2E seeds two organisations with distinct markers and asserts, in both directions, that no marker, evidence label or identifier from one tenant appears anywhere in the other's serialized response. Restricted permission keys are also asserted absent from response bodies.

## Playwright coverage

`apps/web/e2e/authenticated/business-intelligence.spec.ts` — **18 tests, all passing**:

dashboard render · all seven cards · unavailable-history banner · formula version on every card · single-request/no-client-computation · refresh · loading · error + retry recovery · local search with zero network requests · search across evidence/reasoning/sources · evidence drawer contents · keyboard navigation (focus, Enter to open, focus-managed close) · dark mode · four responsive viewports · permission filtering without fabrication · Axe on the page · Axe with the drawer open.

## Accessibility results

Axe (`@axe-core/playwright`), page and drawer:

| Impact | Count |
| --- | --- |
| Critical | **0** |
| Serious | **0** |

One serious `color-contrast` violation was found and fixed during this pass by moving status/priority chips onto the design-system `Badge` tokens.

## Responsive results

Screenshots in `.uiqa/`, `document.scrollWidth <= window.innerWidth` asserted at each:

| Viewport | Result |
| --- | --- |
| 390×844 | no overflow, cards stack single-column |
| 768×1024 | no overflow, two-column grid |
| 1024×900 | no overflow, two-column grid |
| 1440×1000 | no overflow, three-column grid |

## Performance results

| Measure | Value |
| --- | --- |
| Route size (`/executive/business-intelligence`) | 7.82 kB |
| First-load JS | 126 kB |
| Shared first-load JS | 102 kB |
| Network requests for the dashboard | 1 (`GET /business-intelligence`) |
| Refetch | on demand (Refresh) only; `refetchOnWindowFocus` disabled globally |
| Retry | client retries a failed read twice, then surfaces the error state |
| Search requests | **0** — local over cached data |
| Caching | React Query, `staleTime` 30 s |

## Deployment readiness

| Item | Status |
| --- | --- |
| Production env vars | Validated at boot by `src/config/env.validation.ts`; BI adds none |
| PostgreSQL | Reused; BI adds no table and no migration |
| Redis | Optional (`REDIS_ENABLED`); BI inherits the context cache, in-memory fallback verified |
| Object storage | Not used by BI |
| TLS | Terminated upstream; unchanged |
| Monitoring | BI counters/histograms on the existing `/metrics` registry |
| Logging | Existing request-id logger and audit (`resource: business_intelligence`) |
| Health checks | Existing `/readiness`; exercised by the local authenticated environment |
| Secrets | None introduced |
| CI/CD | Existing `ci.yml`; the new Playwright spec runs in `web-e2e-authenticated` |
| Backups / restore | Unchanged; covered by existing regression specs |
| Staging deployment | **Not performed in this pass** — see limitations |
| Smoke tests | Local authenticated environment stood up, real login, dashboard verified |

## Known limitations

1. **Executive Health double-counts the communications source.** Both `customer_success_health` and `communications_health` derive from `communications`, so that section contributes twice to the executive average and appears twice in `sourceModules`/reasoning. This is Formula 1.0 behaviour and was deliberately not changed.
2. **`compliance_health` is sourced from `notifications`**, a proxy rather than a compliance-specific signal.
3. **No historical trend** until the context layer exposes a verified historical source.
4. **Staging deployment and post-deploy smoke tests were not executed** in this pass; readiness was verified locally against a real API, real login and a real database.
5. **Evidence is unbounded per section** in the BI response — it reflects the Executive Context 20-item source budget rather than a BI-specific limit, using Context's own priority/amount/time/identifier tie-breaker.
6. The dashboard's refresh is manual; there is no live push channel.
