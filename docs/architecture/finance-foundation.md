# Finance Foundation

## Scope

The first Voltx 2.0 vertical slice adds an operational finance system of
record. It is separate from the existing Billing module: Billing mirrors the
organization's Voltx subscription and Stripe payment state, while Finance
records the organization's own income, expenses, and spending budgets.

## Architecture

The Finance module is exposed at `/api/v1/finance` and provides:

- financial transaction creation, listing, update, and soft deletion;
- financial budget creation, listing, update, and soft deletion; and
- a server-side cash-flow and budget overview derived from posted records.

`FinancialTransaction` uses a fixed-scale `Decimal(18,2)` amount, ISO 4217
three-letter currencies, an explicit lifecycle (`PENDING`, `POSTED`, `VOID`),
and an occurrence date. `FinancialBudget` has a bounded reporting period and
can be tagged to the existing tenant-local `CostCenter` structure.

All finance records carry `organizationId`. The tenant Prisma extension
intercepts `financialTransaction` and `financialBudget`, adding the active
tenant condition to every scoped query. The service separately checks that an
optional `costCenterId` belongs to the current organization before writing it.
This is intentional defense in depth: a UUID from another tenant is rejected
before persistence, and a direct lookup cannot cross tenant boundaries.

## Security and Auditability

Every API route applies the standard JWT, user context, tenant, and permission
guards. Permissions are deliberately split by resource and operation:

- `finance.report.read`
- `finance.transaction.create|read|update|delete`
- `finance.budget.create|read|update|delete`

The service records each mutation using `AuditService`, which writes through
the existing per-organization hash-chained audit log. Finance readers can view
reports and records; managers, administrators, and owners can mutate them.

## API

| Route | Permission | Purpose |
| --- | --- | --- |
| `GET /finance/overview` | `finance.report.read` | Cash flow, pending spend, and budget variance for a date range. |
| `GET/POST /finance/transactions` | read/create | Browse or record income and expenses. |
| `GET/PATCH/DELETE /finance/transactions/:id` | read/update/delete | Read or manage a tenant-local transaction. |
| `GET/POST /finance/budgets` | read/create | Browse or create period-bounded budgets. |
| `PATCH/DELETE /finance/budgets/:id` | update/delete | Manage a tenant-local budget. |

## Operations

The migration is `20260802010000_add_finance_foundation`. Deploy it with the
normal production migration procedure:

```bash
cd backend
prisma migrate deploy
```

Use a direct database URL for migration execution. Do not use the local E2E
wrapper against production; it is intentionally fixed to `voltx_test`.

## Validation

- `test/finance.service.spec.ts` verifies cost-center ownership, budget period
  validation, audit behavior, and missing-record handling.
- `test/finance.e2e-spec.ts` verifies the HTTP API, reporting arithmetic, audit
  persistence, validation, and cross-tenant read isolation.
- The Finance workspace at `/finance` uses the typed API client, TanStack Query,
  React Hook Form, and Zod. It intentionally renders explicit loading, error,
  and empty states rather than fabricated financial data.