# Object Storage Readiness Decision

## Decision: Option B — storage is **degradable**

Object storage is reported continuously in `/readiness` but does **not** make the API `not_ready`.

| Condition | `status` | In rotation? |
| --- | --- | --- |
| All dependencies up | `ready` | yes |
| Storage down, database + Redis up | `degraded` | **yes** |
| Database or Redis down | `not_ready` | no |

## Why

**Why report it at all.** Storage used to be verified only at application boot. A container that started successfully kept reporting healthy for days after its R2 credentials were revoked — attachments were broken the whole time and nothing said so. A health check that cannot observe a dependency is worse than no check: it actively asserts something false.

**Why not make it essential.** The obvious over-correction is to fail readiness on storage. That would let a single storage outage pull *every* healthy replica out of rotation, turning a partial failure (attachments) into a total one (the whole platform). The executive stack, CRM, finance, workflows and AI assistant do not touch object storage on the request path.

So: visible, alerted, and degradable.

## Boot vs runtime — deliberately different

| Moment | Behaviour |
| --- | --- |
| **Boot** | `S3StorageProvider.verifyProductionReadiness()` **refuses to start** |
| **Runtime** | `checkHealth()` reports `degraded`, keeps serving |

This asymmetry is intentional. A *new* deployment with broken storage config should never reach traffic — fail fast, and the deploy's own health gate stops the rollout. A *running* system that loses storage mid-flight should ride it out rather than take the platform down. Neither guard was weakened.

## Implementation

- `StorageProvider.checkHealth()` — metadata only (`HeadBucket`), never a write, so it is safe on every scrape.
- **2 s timeout** (`STORAGE_HEALTH_TIMEOUT_MS`), well inside any orchestrator probe budget, so a hung endpoint cannot hold readiness open.
- Probes run **concurrently** with database and Redis; readiness takes the slowest, not the sum.
- `checkStorage()` never throws — an unreachable backend is a reported status.
- Failure cause is included in the payload (`dependencies.storage.error`) so operators are not sent to the logs.

## Orchestrator behaviour

`degraded` returns **HTTP 200**. Kubernetes/ECS readiness probes treat it as ready and keep the replica in service — which is the intent. Operators must not configure a probe that treats anything other than `not_ready` as failure, or the decision above is silently inverted.

## Monitoring

| Signal | Value |
| --- | --- |
| `voltx_object_storage_health` | `1` up, `0` down |
| `ObjectStorageDown` | fires after 5m, severity `critical`, with an `absent()` guard |

The `absent()` guard matters: if the metric stops being published entirely, that is also a failure, and a bare `== 0` comparison would ignore it.

## Tests

`backend/test/health-storage-readiness.spec.ts` — 10 cases: ready when up; **degraded not not_ready** when down; cause surfaced; never throws; timeout handled without hanging; essential-dependency failure still outranks degradation; both down → `not_ready`; probed on every call rather than cached from boot; present in the deep health check; probes run concurrently.

## Consequences to accept

1. A storage outage will **not** page via readiness — it pages via `ObjectStorageDown`. If that alert's receiver is misconfigured, the outage is visible only in the payload.
2. Attachment endpoints fail per-request during degradation; there is no queue-and-retry.
3. The UI does not yet render a service-degraded banner — the readiness payload carries the state, but no frontend surface consumes it. See Known limitations.
