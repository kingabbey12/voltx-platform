# Incident — API crash under sustained load (2026-07-26)

**Status:** Root cause eliminated · **Severity:** Critical (blocked production certification)

## Summary

Under sustained load the API process died and was restarted by Docker, losing 13–22% of in-flight requests. It reproduced on every endurance run. The container exited with **139**, which reads as SIGSEGV and initially pointed at a native-module crash.

It was not a segfault. The process ran out of **JavaScript heap**, and the true cause was **per-request logging volume**: `pino-http`'s default serializers dump every request *and response* header on every line. Helmet sets a ~600-byte Content-Security-Policy header on each response, so one request log was ~1,450 bytes. At ~3,500 req/s that is **~5 MB/s** written to stdout — more than Docker's `json-file` driver could drain. Pending writes accumulated in the V8 heap until it hit its ceiling.

## Why the exit code misled us

| Signal | Reality |
| --- | --- |
| `docker events` → `die exitCode=139` | 139 = 128+11 = SIGSEGV, normally a native crash |
| Container logs | `FATAL ERROR: Ineffective mark-compacts near heap limit — Allocation failed - JavaScript heap out of memory` |
| `OOMKilled` | `false` — this was **V8's** heap limit, not the cgroup's |

A V8 heap-exhaustion fatal error normally exits **134** (SIGABRT). This image is Alpine/musl, which has no `backtrace()` and ships no `libexecinfo`. Node prints `----- Native stack trace -----` and then faults while unwinding, so the process dies with SIGSEGV instead. **On Alpine, treat exit 139 as "read the logs", not "native crash".**

The container limit was 1 GiB but V8's `heap_size_limit` was **524 MB** — Node sizes the old space at roughly half of detected memory, so ~500 MB of the container was unusable by the heap.

## Evidence

**Reproduction** — 50 VUs against `GET /readiness`, 3 minutes, 3 independent runs:

| Run | Throughput | Failed | Restart | Memory |
| --- | --- | --- | --- | --- |
| 1 | 3,420 req/s | 13.27% | yes | 250 → 590 MiB |
| 2 | 3,537 req/s | 21.80% | yes | 243 → 572 MiB |
| 3 (instrumented) | 3,543 req/s | 17.53% | `die exit=139` captured | 488 → 568 MiB |

**Isolating the driver** — same load, `LOG_LEVEL=warn` (request logging suppressed):

| Metric | Before | With logging suppressed |
| --- | --- | --- |
| Failures | 17.53% | **0.00%** |
| Restarts | 1 per run | **0** |
| Memory | 250 → 570 MiB, climbing | **flat at ~275 MiB** |
| Throughput | 3,543 req/s | 3,500 req/s |

Suppressing logging removed the crash entirely and flattened memory, while throughput was unchanged. That isolates log volume as the driver rather than request handling.

## Fix

`backend/src/config/pino-logger.config.ts` — explicit `req`/`res` serializers replacing pino-http's defaults:

```ts
serializers: {
  req: (req) => ({ id: req.id, method: req.method, url: req.url }),
  res: (res) => ({ statusCode: res.statusCode }),
}
```

**1,450 bytes → 274 bytes per line (5.3×).** Retained: request id, method, url, status code, `responseTime`, and the trace/span ids from the mixin. Dropped: the request and response header dumps.

Chosen over the alternatives deliberately:

- **Not** `LOG_LEVEL=warn` in production — that removes request logging entirely, which is needed for debugging and audit.
- **Not** raising `--max-old-space-size` — that only postpones the crash; the growth was unbounded relative to the ceiling.

A side benefit: no header is serialised at all now, so header redaction is structurally unnecessary rather than merely configured — `authorization` and `cookie` cannot leak into logs.

## Validation

With the fix and `LOG_LEVEL=info` restored, identical workload:

| Metric | Result |
| --- | --- |
| Failures | **0.00%** (604,441 requests) |
| Restarts / `die` events | **0 / 0** |
| Memory | **flat, 266 → 276 MiB** |
| Throughput | 3,358 req/s |

## Operational notes

- **Log volume is a capacity dimension.** Anything logged per request is multiplied by throughput. Adding a field to the request log is a load-bearing change.
- **The heap ceiling is ~half the container limit.** Sizing a container by expected RSS understates what Node can actually use.
- **`OOMKilled: false` does not mean "not out of memory."** It means the *cgroup* did not kill it; V8 has its own limit and dies first.
- This was invisible to 1,462 passing tests, a clean build and a clean security audit. It took four minutes of sustained load to surface.
