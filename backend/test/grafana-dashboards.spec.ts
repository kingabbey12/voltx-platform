import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const GRAFANA_DIR = join(__dirname, '..', 'ops', 'grafana');

// The full set of series names that can actually be scraped from
// GET /metrics (src/modules/metrics/metrics.service.ts) — a Counter named
// `foo` exposes literally `foo`; a Histogram named `bar` exposes
// `bar_bucket`/`bar_sum`/`bar_count`. Kept in sync by hand (there are only
// a handful of metrics) rather than parsed out of the service file, so a
// dashboard referencing a metric that doesn't exist fails this test
// instead of silently rendering "No data" in Grafana.
const REAL_METRIC_SERIES = new Set([
  'voltx_http_requests_total',
  'voltx_http_request_duration_ms_bucket',
  'voltx_http_request_duration_ms_sum',
  'voltx_http_request_duration_ms_count',
  'voltx_queue_depth',
  'voltx_sso_login_total',
  'voltx_scim_operations_total',
  'voltx_mfa_challenges_total',
  'voltx_session_revocations_total',
]);

interface GrafanaPanel {
  id: number;
  title: string;
  targets?: { expr?: string }[];
}

interface GrafanaDashboard {
  title: string;
  uid: string;
  schemaVersion: number;
  panels: GrafanaPanel[];
}

function loadDashboard(filename: string): GrafanaDashboard {
  const raw = readFileSync(join(GRAFANA_DIR, filename), 'utf-8');
  return JSON.parse(raw) as GrafanaDashboard;
}

function extractMetricNames(expr: string): string[] {
  const matches = expr.match(/voltx_[a-zA-Z0-9_]+/g);
  return matches ?? [];
}

describe('Grafana dashboard definitions (ops/grafana/*.json)', () => {
  const filenames = readdirSync(GRAFANA_DIR).filter((name) => name.endsWith('.json'));

  it('ships at least one dashboard', () => {
    expect(filenames.length).toBeGreaterThan(0);
  });

  it.each(filenames)('%s is well-formed and self-consistent', (filename) => {
    const dashboard = loadDashboard(filename);

    expect(dashboard.title).toEqual(expect.any(String));
    expect(dashboard.uid).toEqual(expect.any(String));
    expect(Array.isArray(dashboard.panels)).toBe(true);
    expect(dashboard.panels.length).toBeGreaterThan(0);

    const panelIds = dashboard.panels.map((panel) => panel.id);
    expect(new Set(panelIds).size).toBe(panelIds.length);
  });

  it.each(filenames)('%s references only real, currently-registered metric names', (filename) => {
    const dashboard = loadDashboard(filename);

    for (const panel of dashboard.panels) {
      for (const target of panel.targets ?? []) {
        if (!target.expr) {
          continue;
        }
        for (const metricName of extractMetricNames(target.expr)) {
          expect(REAL_METRIC_SERIES.has(metricName)).toBe(true);
        }
      }
    }
  });
});
