# Voltx 2.0 Delivery Roadmap

## Delivery Model

Voltx 2.0 is delivered as deployable vertical slices. A slice is complete only
when its migration, API, permissions, audit behavior, user workflow,
documentation, and focused automated tests are in the same release. Existing
1.0 contracts remain stable while modules evolve behind their own routes and
permissions.

## Completed Foundation

The Finance Foundation slice is implemented. It establishes an audited,
tenant-scoped system of record for transactions and budgets, a reporting API,
and the Finance workspace. See [finance-foundation.md](finance-foundation.md).

## Next Slices

### Finance Operations

1. Import adapters for accounting providers using encrypted connection
   credentials and an idempotent sync-run ledger.
2. Invoice and expense approval workflows, using the existing workflow approval
   mechanism rather than a parallel approval system.
3. Category and cost-center budget variance analytics, exports, and scheduled
   report delivery.
4. A Finance Agent tool source constrained to tenant-local, read-only reporting
   data by default. Any transaction mutation must require an approval.

### CRM and Sales Intelligence

1. Lead scoring and opportunity forecast jobs with evaluation datasets and
   explainable factor outputs.
2. Revenue forecasting that combines only explicitly compatible currencies and
   time windows.
3. Customer sentiment ingestion from the existing communications records,
   retaining source links and confidence metadata.

### Operations and Support

1. Project and workload records linked to the existing task/activity and
   workflow models.
2. SLA policy records and background breach monitors using BullMQ.
3. Customer support ticket workflows that reuse the omnichannel conversation
   timeline and knowledge retrieval layers.

### AI Builder and Multi-Agent Governance

1. A proposal model for generated forms, data models, dashboards, workflows,
   permissions, and automations.
2. Mandatory reviewer approval and an immutable generated-change audit trail
   before any proposal can apply changes.
3. Agent capability manifests, per-tool permission checks, encrypted provider
   credentials, output citations, and evaluation suites for every agent role.

### Platform Scale and Release Operations

1. Redis/BullMQ backlog monitoring, retry policies, dead-letter runbooks, and
   queue-specific metrics.
2. Read-replica routing for report endpoints proven tolerant of replica lag.
3. Accessibility regression checks, authenticated browser coverage for every
   new critical workflow, and mobile CI results attached to each release.
4. Production migration rehearsals, restore drills, and release gates tied to
   migration compatibility.

## Non-Negotiable Release Gates

- New organization-scoped Prisma models must be registered in the tenant
  extension and have a cross-tenant E2E test.
- Any mutation must have input validation, RBAC, and audit coverage.
- External integrations must be adapter-backed, encrypted where credentials are
  stored, and safe to retry.
- AI-generated changes require a human approval step before execution.
- A module does not advertise capabilities without a persisted domain model and
  tested end-to-end workflow behind it.