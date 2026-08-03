# Executive Command Center

`/executive` is a frontend composition of existing tenant-scoped APIs. It owns no business calculation, event store, approval mutation, or AI runtime. The Decision Center consumes `/ai/decisions`, the Workflow Queue consumes `/ai/workflow-plans`, and the Executive Summary, department availability notices, and source exclusions consume `/ai/insights`.

Each section has its own TanStack Query key and loading/error/retry boundary, so an unavailable workflow-plan endpoint does not blank decisions or insights. Existing server-side authentication, RBAC, tenant isolation, and permission filtering remain authoritative. The client never previews excluded source data.

Risks and opportunities are presentation-only views of decision evidence. Workflow plans display their confirmed status and approval identifier; there is no execute control. Department scores explicitly remain unavailable until the Business Intelligence module delivers a verified scoring contract.

The existing shell Command Palette remains the navigation surface. Command Center scoped search and comprehensive approval/timeline composition require a verified list/search API for each resource and are intentionally not fabricated here. The responsive layout uses one column by default and two columns at large widths; focusable cards, labelled refresh control, heading hierarchy, status text, and local error retry support keyboard and screen-reader use.

The Approval Center is intentionally labelled by behavior as the existing pending-workflow-approval API (`/workflows/approvals`); broader approval history is not exposed by that contract. Opportunity data comes from `/sales/opportunities`. The timeline normalizes generated decision timestamps and persisted workflow-plan timestamps only. Search is local over the already permission-filtered cached Decisions, Plans, and Opportunities query results, so it creates no search API requests. Query keys are `['ai','decisions']`, `['executive-insights']`, `['ai','workflow-plans']`, `['workflows','approvals',1,20]`, and `['sales','opportunities','executive']`.

## QA execution results — 2026-08-03

The focused suite is `apps/web/e2e/authenticated/executive-command-center.spec.ts`. It ran against a disposable `voltx_e2e` PostgreSQL database with the repository migrations and RBAC seed applied, a real local API at `http://localhost:3003`, and a real registered/onboarded owner user. The Next/Playwright server ran at `http://localhost:3010` because port 3001 was already occupied by a separate local container.

The exact focused run completed with **7 passed in 20.3 seconds** (one authentication setup test and six Command Center checks). Initial loads issued exactly one GET each to `/ai/insights`, `/ai/decisions`, `/ai/workflow-plans`, `/workflows/approvals`, and `/sales/opportunities`. Local search is debounced by 250 ms and issued zero API requests; it supports clear, Escape, Arrow Up/Down, and Enter activation over the permission-filtered cached result set. Queries opt out of automatic retry so that a failed section has one explicit, independently scoped Retry control. The suite intercepts an Insights failure, proves other sections remain present, and confirms the retry makes exactly one further Insights request.

Responsive artifacts for 1440×1000, 1024×900, 768×1024, and 390×844 are emitted under Playwright `test-results`; each viewport passes `document.documentElement.scrollWidth <= window.innerWidth`. The current production build reports `/executive` at 4.35 kB with 128 kB first-load JavaScript. Frontend ESLint, TypeScript, production build, and `git diff --check` pass.

The section label is **Pending Approvals** and represents only the pending `/workflows/approvals` contract; it does not imply approved, rejected, expired, or cancelled history. The Command Palette filters entries that declare required permissions from the current authenticated session, including Executive (`ai.agent.run`), CRM records, and Finance reporting.

The remaining QA work is intentionally recorded rather than inferred: the current fixture creates only an owner, so the CRM-limited, Finance-limited, and approval-restricted browser matrix has not executed; and the project has no Axe or equivalent accessibility dependency, so an automated zero-critical/zero-serious audit has not executed. Semantic landmarks, labels, loading statuses, retry names, dialog focus behavior, and responsive keyboard paths are covered by the focused suite, but that is not a WCAG conformance claim.
