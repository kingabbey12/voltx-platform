#!/usr/bin/env bash
# ── Prometheus textfile metric writer ────────────────────────────────
# Writes a .prom file atomically (temp + mv). node-exporter reads this
# directory mid-write otherwise and republishes a truncated file, which
# surfaces as a metric that randomly disappears.
#
#   write_metrics <name-without-extension> <<'METRICS'
#   # HELP ...
#   METRICS
set -euo pipefail

METRICS_DIR="${METRICS_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/metrics}"

write_metrics() {
  local name="$1" target tmp
  mkdir -p "$METRICS_DIR"
  target="${METRICS_DIR}/${name}.prom"
  tmp="$(mktemp "${METRICS_DIR}/.${name}.XXXXXX")"
  cat > "$tmp"
  chmod 644 "$tmp"
  mv -f "$tmp" "$target"
}
