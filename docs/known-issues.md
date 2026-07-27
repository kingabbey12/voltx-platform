# Known Issues & Limitations

**Applies to:** Limited Beta (RC1) · **Last verified:** 2026-07-26 against the running staging stack.

This is the authoritative list. `docs/release/known-issues.md` is superseded — see `docs/release/README.md`.

Everything below was confirmed by running the system, not by reading the code. Where something is unverified, it says so.

---

## Operational limitations a beta customer may notice

| Issue | Severity | Impact on customer | Workaround |
|---|---|---|---|
| **Deploys cause a brief outage** | Medium | Requests fail for a few seconds during each deploy. Single-replica compose stops the old container before starting the new one. | Deploy in a low-traffic window; announce it |
| **AI multi-agent runs can time out** | Medium | Runs exceeding `AI_MULTI_AGENT_TIMEOUT_MS` (300s) abort | Break tasks into smaller steps, or raise the limit |
| **Knowledge graph traversal is 1 hop** | Low | Indirectly related documents are not retrieved | Raise `KNOWLEDGE_RETRIEVAL_GRAPH_HOPS` (costs latency) |
| **Rate limiting sees the proxy IP** | Low | Per-client limits behave as per-proxy limits behind nginx | Tune `TRUSTED_PROXY_COUNT` for the topology |

## Operational gaps the team must know about

| Gap | Severity | Status |
|---|---|---|
| **Alert delivery is unconfigured** | **High** | The pipeline is proven end-to-end (alert → Alertmanager → external webhook, observed). `deploy/alertmanager/webhook_url` still holds the placeholder, so **alerts currently reach no human**. One line to fix; blocks beta. |
| **Certificate monitoring unvalidated** | High | `probe_ssl_earliest_cert_expiry` needs the public hostnames to resolve from the monitoring network. They do not resolve locally, so this has never produced data. **TLS renewal is manual** — track expiry out-of-band until proven. |
| **Backups are not scheduled** | High | `backup.sh` works (verified 2026-07-26: 48 KB artifact, integrity check passed) and `deploy.sh` takes one pre-migration. The daily cron in `docs/operations/backup-and-restore.md` is a **manual install step**. Until installed, RPO is "since last deploy". |
| **Restore RTO measured only on trivial data** | Medium | A full backup→destroy→restore→verify cycle passed with byte-identical data, but on ~2,500 rows. Recovery time at production volume is unknown. |
| **Rate limiting is per-process** | Medium | Correct at the current single replica. **Scaling to 2+ API replicas multiplies effective limits** and requires a Redis-backed store first. |
| **CI has never been observed executing** | Medium | Triggers, blocking steps and audit gates are configured and unit-tested, but no pipeline run has been watched. |
| **Only unauthenticated endpoints load-tested** | Medium | 5.9M requests over 30 min at 3,270 req/s, 0 failures — but against `/readiness`. Authenticated and AI paths are unmeasured. |

## Resolved during hardening — listed so they are not re-reported

| Was | Resolution |
|---|---|
| API crashed under sustained load (exit 139) | JS heap exhaustion from 1,450-byte-per-request logs. Serializers trimmed to 274 bytes. Verified: 5,885,289 requests, 0 failures, flat memory |
| Readiness returned 200 while unhealthy | Now returns 503 on dependency loss (verified at runtime) |
| Schedulers duplicated on every replica | Redis-backed distributed locking |
| 15 high-severity dependency advisories | Zero known vulnerabilities in both trees |
| `/metrics` unauthenticated | Token-gated; production refuses to boot without the token |
| Five false-positive critical alerts | Rules corrected; 0 false positives firing |
| Web container healthcheck passed via a login redirect | Real `/health` route; check asserts a direct 200 |

## Configuration notes

- **CSP** enforced on the web app; the API serves JSON only. nginx adds headers at the edge.
- **OpenTelemetry** installed, disabled by default (`OTEL_ENABLED=false`).
- **Sentry** is a no-op until `SENTRY_DSN` is set.
- **Redis** uses AOF (`everysec`). Single instance — no Sentinel/Cluster. Redis loss stops all background work (fails closed, so nothing duplicates).
- **`METRICS_AUTH_TOKEN` is mandatory in production.** The API will not boot without it, and `deploy.sh` pre-flight aborts before swapping containers.

## Measured performance envelope

Established 2026-07-26 on 2 CPU / 1 GiB, single replica, against `/readiness`:

| Metric | Value |
|---|---|
| Sustained throughput | **~3,300 req/s** (30 min, 0.00% errors) |
| p95 / p99 latency | **29 ms / 54 ms** |
| Under stress (500 VUs) | 3,173 req/s, p99 201 ms, 0.00% errors |
| Bottleneck | **API CPU** (~195% of a 200% cap). Postgres 9%, Redis 3% |
| Steady-state memory | ~275 MiB of 1 GiB |

**Scaling implication:** the API is CPU-bound, so growth means more API replicas — which requires distributed rate limiting first.
