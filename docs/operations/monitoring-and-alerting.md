# Monitoring and Alerting

## What exists

| Component | Where | Purpose |
| --- | --- | --- |
| Prometheus | `deploy/prometheus/prometheus.yml`, port 9090 | Scrapes and evaluates rules |
| Alert rules | `deploy/prometheus/alerts.yml` | 19 rules across availability, HTTP, queues, datastores, host, TLS |
| Alertmanager | `deploy/alertmanager/alertmanager.yml`, port 9093 | Routes, groups, and inhibits firing alerts |
| Grafana | port 3002 | Dashboards |
| Exporters | postgres, redis, node, blackbox | Produce the `pg_*`, `redis_*`, `node_*`, `probe_*` series |

`./deploy/deploy.sh` starts all of it — the monitoring services are part of the standard deployment, not an optional extra. To bring them up on their own:

```bash
docker compose -f deploy/docker-compose.yml --profile monitoring up -d
```

The `--profile monitoring` flag is not optional. Compose silently creates nothing for a profiled service when the profile is omitted, which is exactly how this stack was configured but never actually running.

## Two things you must configure before this is useful

**1. Alert delivery.** Alertmanager does not expand environment variables in its config, so the receiver URL is read from a file:

```bash
cp deploy/alertmanager/webhook_url.example deploy/alertmanager/webhook_url
# then edit it to your Slack / PagerDuty / Opsgenie endpoint
```

Until you do, alerts fire and are visible at `:9093` but are **delivered nowhere**. That default is deliberate — an obviously unconfigured receiver is safer than one that silently drops pages.

**2. The metrics scrape token.** `/metrics` exposes route inventory, per-route error rates, queue depths and process internals, and is exempt from rate limiting. It is token-protected whenever `METRICS_AUTH_TOKEN` is set, and **production refuses to boot without it**.

```bash
# same value in both places
METRICS_AUTH_TOKEN=<32+ chars>            # deploy/.env
cp deploy/prometheus/metrics_token.example deploy/prometheus/metrics_token
```

If scrapes return 401, these two have drifted apart.

## Verifying it works

```bash
docker run --rm -v "$PWD/deploy/prometheus:/etc/prometheus:ro" \
  --entrypoint promtool prom/prometheus:latest check config /etc/prometheus/prometheus.yml
```

Then check every target is `UP` at `http://<host>:9090/targets`. A target stuck `DOWN` means its exporter is not running — this is the failure this stack previously had for postgres, redis and node simultaneously, which made those dashboards silently empty.

Force an end-to-end delivery test by stopping a non-critical service and confirming the notification arrives (`ApiDown` fires after 1 minute).

`backend/test/monitoring-config.spec.ts` fails the build if a rule references a metric nothing emits, a scrape target has no service behind it, or an alert loses its runbook link.

---

# Runbooks

Each heading below is the anchor an alert's `runbook` annotation points at.

## ApiDown

**Means:** Prometheus cannot scrape the API for 1 minute. The process is down, wedged, or `/metrics` is failing.

1. `docker compose -f deploy/docker-compose.yml ps api`
2. `docker compose ... logs --tail=200 api`
3. Check `/readiness` directly — it returns 503 when a dependency is down, which distinguishes "API is up but Postgres/Redis is not" from "API is gone".
4. If the container is restarting, look for the fail-fast messages: missing `REDIS_ENABLED`, missing `METRICS_AUTH_TOKEN`, or failed env validation.
5. Roll back with `deploy/deploy.sh` if a deploy immediately preceded it.

## WebDown

**Means:** the blackbox probe of `http://web:3000/health` is failing. The API may still be healthy — check `ApiDown` first; if it is not firing, the blast radius is UI only.

Measured by HTTP probe rather than a metrics scrape: Next.js exposes no Prometheus endpoint, so an earlier `up{job="voltx-web"}` rule could never be satisfied and fired permanently. The probe deliberately does **not** follow redirects — `/health` must return 200 directly. If it 307s, `/health` has fallen out of `PUBLIC_PATHS` in `apps/web/src/middleware.ts` and the middleware is redirecting it to `/login`, which would otherwise mask an unhealthy app.

## ExporterDown

**Means:** an exporter is not being scraped. **No customer impact, but you are now blind** in that dimension — its dashboards are empty and its alerts cannot fire.

Confirm the service is declared *and* running: `docker compose ... --profile monitoring ps`. A service that exists in `prometheus.yml` but not in the compose file will never come up.

## HighServerErrorRate

**Means:** more than 5% of requests are 5xx (critical) or more than 1% for 10 minutes (warning).

1. Grafana → error rate by route to find which endpoint.
2. `docker compose ... logs api | grep -i error` — every log line carries a request ID.
3. Check whether `PostgresDown`, `RedisDown` or a queue alert is also firing; if so treat this as a symptom and fix the cause.
4. If it began at a deploy, roll back (`docs/rollback-plan.md`).

## HighRequestLatencyP99

**Means:** p99 above 2.5s for 10 minutes. Usually database contention, an AI provider stalling, or event-loop saturation.

Check `PostgresConnectionsSaturating`, then the Node event-loop lag panel. AI endpoints can legitimately be slow — confirm whether the latency is concentrated on `/ai/*` routes before treating it as a platform regression.

## QueueBacklogGrowing

**Means:** more than 500 jobs waiting for 10 minutes. Workers are slower than intake.

Inspect depth per queue in Grafana. Check whether a downstream provider is rate-limiting. Scaling API replicas adds workers — scheduler locking makes that safe.

## QueueJobsFailing

**Means:** jobs are exhausting retries and dead-lettering. **Work is being lost.**

Query `BackgroundJobFailure` for the failure reason. This is usually a bad payload or a persistently failing downstream, not capacity.

## QueueStalled

**Means:** jobs are waiting but nothing is active for 15 minutes — no worker is consuming.

The dangerous one, because nothing errors. Check Redis reachability, then confirm the API process actually registered its processors (they only register when `REDIS_ENABLED=true`).

## PostgresDown

**Means:** the database is unreachable. Total outage.

1. `docker compose ... ps postgres` and its logs.
2. Check disk — see `DiskSpaceLow`. A full volume stops Postgres accepting writes.
3. If the data directory is damaged, restore per `docs/operations/backup-and-restore.md`. **Note: restore has not yet been exercised in a game day.**

## PostgresConnectionsSaturating

**Means:** over 80% of `max_connections` in use. New connections will start being refused.

Look for a connection leak (a rising floor that never drops) versus genuine load. Pool sizing is `DATABASE_CONNECTION_LIMIT`.

## RedisDown

**Means:** Redis is unreachable. **All background work stops.**

Queues and the distributed scheduler lock both depend on it. Scheduled sweeps fail *closed* by design, so nothing duplicates — but nothing runs either. Jobs already enqueued survive if AOF persistence is intact.

## RedisMemoryHigh

**Means:** over 85% of the memory limit. Eviction is imminent, and evicting a queue key or a scheduler lock loses work or permits a duplicate run.

## DiskSpaceLow

**Means:** under 15% free (5% critical).

Usual causes: Postgres WAL growth, container logs, accumulated backups under `deploy/backups`. Retention pruning lives in `deploy/scripts/backup.sh`.

## HostMemoryPressure

**Means:** under 10% host memory available. The OOM killer will start terminating containers, typically Postgres first.

## CertificateExpiringSoon

**Means:** under 21 days remaining (7 days critical). **Renewal is manual today** — there is no automated ACME renewal in this stack, which is why the warning window is deliberately long.

Renew, place the new pair in `deploy/nginx/ssl/`, and reload nginx.

## EndpointProbeFailing

**Means:** the blackbox prober cannot complete an HTTPS request against the public endpoint, even if internal scrapes look fine. Suspect nginx, TLS, or DNS rather than the app.

---

## Known gaps

- **Alert delivery is unproven.** The stack is validated by `promtool`/`amtool` and by tests, but no alert has been observed reaching a real receiver. This is the single largest remaining gap in observability.
- **No paging rota or escalation policy** — alerts route to one webhook.
- **External blackbox probes need public DNS.** `EndpointProbeFailing` fires wherever `api-staging.voltx.ai` / `app-staging.voltx.ai` do not resolve, which includes local developer machines. Certificate monitoring depends on those probes, so it can only be validated in an environment with real DNS.
- **`backend/docker-compose.prod.yml` has no monitoring stack** — by design. It is an API-only subset for running the backend in isolation; its header says so, and `deployment-topology.spec.ts` keeps the production docs pointed at `deploy/deploy.sh` instead.
