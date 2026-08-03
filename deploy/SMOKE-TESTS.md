# Staging Smoke Tests

## Status

**NOT RUN.** Smoke tests require a healthy staging deployment reachable over HTTPS. The staging API cannot boot because object-storage credentials return 401 (see [R2.md](R2.md)), so there is nothing to smoke-test.

The authenticated Playwright suite (67 tests) exercises the same user journeys against a **local** environment and passes, but that is not a substitute: it does not exercise nginx, TLS, the production build path, Redis-backed queues, or real object storage.

## Procedure once staging is healthy

Run against the real HTTPS staging URL, capturing pass/fail per item.

### Authentication
Login · logout · token refresh · session persistence · owner login · CRM-limited login · Finance-limited login · approval-restricted login.

The four identities are provisioned by `backend/prisma/seed-e2e-fixtures.ts`. `apps/web/e2e/authenticated/sign-in.ts` fails closed if a login resolves to a different identity, so a missing fixture cannot silently degrade into an owner-only run.

### Tenant and permissions
Correct organization context · restricted navigation hidden · restricted API returns 403 · cross-tenant record inaccessible · search excludes restricted data · command palette excludes restricted destinations.

### Executive stack
Command Center · Context · Insights · Decisions · Multi-Agent Orchestrator · Workflow Plans · Pending Approvals · Business Intelligence · AI Assistant.

### Business modules
CRM · Finance · Communications · Notifications · Workflows · Search · Command Palette.

### Workflow safety
1. Generate a plan.
2. Submit for approval.
3. Confirm `awaiting_approval`.
4. Approve through the existing approval flow.
5. Hand off to workflow infrastructure.
6. Confirm the AI module did not execute the action itself.
7. Confirm the audit trail records generation, approval and handoff.

This is the single most important sequence to verify manually: it is the boundary between recommendation and execution.

### Infrastructure
Object upload/read/delete · Redis read/write · database read/write · background job · metrics scrape · alert delivery · backup command · log capture.

### Security
Unauthenticated → 401 · missing permission → 403 · cross-tenant → inaccessible · invalid CORS origin rejected · HTTPS redirect · certificate trusted · security headers present · no secrets in responses or logs.

## What is already proven locally

| Area | Evidence |
| --- | --- |
| Permission matrix (4 real identities) | Playwright, fail-closed sign-in |
| Workflow plan approval + handoff | backend E2E `ai-workflow-plans.e2e-spec.ts` |
| 401 / 403 / cross-tenant | backend E2E across insights, decisions, orchestrator, workflow plans, BI |
| Object round-trip | **not proven** — credentials invalid |
| TLS / headers / redirect | **not proven** — self-signed cert, no public ingress |
