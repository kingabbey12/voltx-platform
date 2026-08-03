import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { load } from 'js-yaml';

/**
 * Validates the monitoring stack as configuration, because its failure modes
 * are silent by nature: a scrape job whose exporter was never deployed, or an
 * alert rule referencing a metric nobody emits, both look exactly like "no
 * problems detected".
 *
 * Both had actually happened here. prometheus.yml scraped postgres-exporter,
 * redis-exporter and node-exporter — none of which existed as services — so 3
 * of 5 targets were permanently down and every dashboard panel fed by them was
 * empty. Separately there were no alert rules and no Alertmanager at all, so
 * nothing could page anyone regardless.
 */

const repoRoot = join(__dirname, '..', '..');
const deployDir = join(repoRoot, 'deploy');

function readYaml<T>(relativePath: string): T {
  return load(readFileSync(join(deployDir, relativePath), 'utf8')) as T;
}

interface PrometheusConfig {
  rule_files?: string[];
  alerting?: { alertmanagers?: { static_configs?: { targets?: string[] }[] }[] };
  scrape_configs?: {
    job_name: string;
    static_configs?: { targets?: string[] }[];
    relabel_configs?: { replacement?: string }[];
  }[];
}

interface AlertRules {
  groups: {
    name: string;
    rules: {
      alert: string;
      expr: string;
      for?: string;
      labels?: Record<string, string>;
      annotations?: Record<string, string>;
    }[];
  }[];
}

interface ComposeFile {
  services: Record<string, { image?: string; volumes?: string[] }>;
  volumes?: Record<string, unknown>;
}

const prometheus = readYaml<PrometheusConfig>('prometheus/prometheus.yml');
const alerts = readYaml<AlertRules>('prometheus/alerts.yml');
const compose = readYaml<ComposeFile>('docker-compose.yml');
const allRules = alerts.groups.flatMap((group) => group.rules);

/**
 * Watchdog is a dead-man's switch, not an incident alert. It is deliberately
 * always-firing with no `for:` delay (a gap in delivery is the signal, so any
 * delay would blunt it) and carries its own `watchdog` severity so it routes
 * to the heartbeat endpoint rather than to whoever is on call. Every other
 * rule must still satisfy both requirements below.
 */
const HEARTBEAT_ALERTS = new Set(['Watchdog']);
const incidentRules = allRules.filter((rule) => !HEARTBEAT_ALERTS.has(rule.alert));

describe('Prometheus is wired to alert, not just collect', () => {
  it('loads the alert rule file', () => {
    expect(prometheus.rule_files).toContain('/etc/prometheus/alerts.yml');
  });

  it('points at an Alertmanager', () => {
    const targets = prometheus.alerting?.alertmanagers?.flatMap(
      (manager) => manager.static_configs?.flatMap((config) => config.targets ?? []) ?? [],
    );
    expect(targets).toContain('alertmanager:9093');
  });

  it('declares Alertmanager as a service so the target resolves', () => {
    expect(compose.services.alertmanager).toBeDefined();
  });
});

describe('every scrape target has a service behind it', () => {
  // The regression this exists for: scraping an exporter that was never
  // deployed produces a permanently-down target, which reads as silence.
  const serviceNames = new Set(Object.keys(compose.services));

  const scrapedHosts = (prometheus.scrape_configs ?? []).flatMap((job) => {
    // The blackbox job's real endpoint comes from relabelling, not the target
    // list (targets there are probed URLs, not hosts).
    const replacement = job.relabel_configs?.find((rule) => rule.replacement)?.replacement;
    if (replacement) {
      return [replacement.split(':')[0]];
    }
    return (job.static_configs ?? [])
      .flatMap((config) => config.targets ?? [])
      .filter((target) => !target.startsWith('http'))
      .map((target) => target.split(':')[0]);
  });

  it.each([...new Set(scrapedHosts)])('%s is a declared compose service', (host) => {
    expect(serviceNames.has(host)).toBe(true);
  });
});

describe('alert rules are well-formed and actionable', () => {
  it('defines rules across every operational domain the platform depends on', () => {
    const names = allRules.map((rule) => rule.alert);
    for (const expected of [
      'ApiDown',
      'HighServerErrorRate',
      'HighRequestLatencyP99',
      'QueueBacklogGrowing',
      'QueueJobsFailing',
      'PostgresDown',
      'RedisDown',
      'DiskSpaceLow',
      'CertificateExpiringSoon',
    ]) {
      expect(names).toContain(expected);
    }
  });

  it.each(incidentRules.map((rule) => [rule.alert, rule] as const))(
    '%s has a severity, a summary and a runbook link',
    (_name, rule) => {
      expect(['critical', 'warning']).toContain(rule.labels?.severity);
      expect(rule.annotations?.summary).toBeTruthy();
      expect(rule.annotations?.runbook).toContain('monitoring-and-alerting.md');
    },
  );

  it.each(incidentRules.map((rule) => [rule.alert, rule] as const))(
    '%s waits before firing so a single scrape blip cannot page anyone',
    (_name, rule) => {
      expect(rule.for).toBeTruthy();
    },
  );

  it.each([...HEARTBEAT_ALERTS].map((name) => [name] as const))(
    '%s is an always-firing heartbeat, documented and separately routed',
    (name) => {
      const rule = allRules.find((candidate) => candidate.alert === name);
      expect(rule).toBeDefined();
      // No `for:` and a non-paging severity are the point, not an oversight.
      expect(rule?.for).toBeUndefined();
      expect(rule?.labels?.severity).toBe('watchdog');
      expect(rule?.expr).toContain('vector(1)');
      expect(rule?.annotations?.runbook).toContain('monitoring-and-alerting.md');
    },
  );

  it('every runbook anchor an alert links to exists in the runbook', () => {
    const runbook = readFileSync(
      join(repoRoot, 'docs/operations/monitoring-and-alerting.md'),
      'utf8',
    );
    const headingAnchors = new Set(
      [...runbook.matchAll(/^#{2,4}\s+(.+)$/gm)].map(([, heading]) =>
        heading
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .trim()
          .replace(/\s+/g, '-'),
      ),
    );

    const missing = [
      ...new Set(
        allRules
          .map((rule) => rule.annotations?.runbook?.split('#')[1])
          .filter((anchor): anchor is string => Boolean(anchor)),
      ),
    ].filter((anchor) => !headingAnchors.has(anchor));

    expect(missing).toEqual([]);
  });
});

describe('alert expressions only reference metrics something emits', () => {
  const metricsService = readFileSync(
    join(repoRoot, 'backend/src/modules/metrics/metrics.service.ts'),
    'utf8',
  );

  // `voltx_*` series must come from our own registry; the rest come from the
  // exporters declared in compose. A renamed metric would otherwise leave an
  // alert that can never fire.
  const emittedVoltxMetrics = new Set(
    [...metricsService.matchAll(/name:\s*'(voltx_[a-z_]+)'/g)].map(([, name]) => name),
  );

  // Cron-driven backup jobs have no scrape endpoint of their own, so they
  // publish through node-exporter's textfile collector instead of the Nest
  // registry. They are still `voltx_*` and must still be real, so read what
  // the scripts actually write rather than exempting them.
  const textfileMetrics = new Set(
    readdirSync(join(repoRoot, 'deploy/scripts'))
      .filter((file) => file.endsWith('.sh'))
      .flatMap((file) => [
        ...readFileSync(join(repoRoot, 'deploy/scripts', file), 'utf8').matchAll(
          /^(voltx_[a-z_]+)\s/gm,
        ),
      ])
      .map(([, name]) => name),
  );

  const referencedVoltxMetrics = new Set(
    allRules.flatMap((rule) => [...rule.expr.matchAll(/\b(voltx_[a-z_]+)\b/g)].map(([, m]) => m)),
  );

  it.each([...referencedVoltxMetrics])('%s is defined in MetricsService', (metric) => {
    // Histograms are queried via their generated _bucket/_sum/_count series.
    const base = metric.replace(/_(bucket|sum|count)$/, '');
    expect(
      emittedVoltxMetrics.has(base) ||
        emittedVoltxMetrics.has(metric) ||
        textfileMetrics.has(base) ||
        textfileMetrics.has(metric),
    ).toBe(true);
  });

  it.each([
    ['pg_', 'postgres-exporter'],
    ['redis_', 'redis-exporter'],
    ['node_', 'node-exporter'],
    ['probe_', 'blackbox-exporter'],
  ])('metrics prefixed %s have %s deployed to produce them', (prefix, service) => {
    const isReferenced = allRules.some((rule) => new RegExp(`\\b${prefix}`).test(rule.expr));
    if (isReferenced) {
      expect(compose.services[service]).toBeDefined();
    }
  });
});

describe('scrape credentials and receiver endpoints are not committed', () => {
  const gitignore = readFileSync(join(deployDir, '.gitignore'), 'utf8');

  it.each([
    ['prometheus/metrics_token', 'the /metrics bearer token'],
    ['alertmanager/webhook_url', 'the Alertmanager receiver URL, which may embed a vendor key'],
  ])('%s is git-ignored (%s)', (path) => {
    expect(gitignore).toContain(path);
  });

  it.each(['prometheus/metrics_token.example', 'alertmanager/webhook_url.example'])(
    'ships %s so an operator knows what to create',
    (example) => {
      expect(() => readFileSync(join(deployDir, example), 'utf8')).not.toThrow();
    },
  );
});

/**
 * Guards against alert rules that fire on a healthy system. Three did, and all
 * three were delivered as pages before being caught by running the stack:
 *
 *  - RedisMemoryHigh divided by clamp_min(redis_memory_max_bytes, 1); with no
 *    `maxmemory` configured that metric is 0, so the ratio became used_bytes/1
 *    and the alert fired permanently.
 *  - DiskSpaceLow/Critical filtered only on fstype, so Docker Desktop's
 *    /run/jfs and /run/rosetta pseudo-mounts — which report 0 bytes available —
 *    matched, and both fired on a host with 77 GiB free.
 *  - WebDown watched up{job="voltx-web"}, but Next.js exposes no Prometheus
 *    endpoint, so that target could never be up.
 *
 * Five criticals were firing simultaneously on a healthy system. An alerting
 * system that pages wrongly on day one gets muted, which is worse than none.
 */
describe('alert rules do not fire on a healthy system', () => {
  const ruleByName = (name: string) => allRules.find((rule) => rule.alert === name);

  it('RedisMemoryHigh requires a configured maxmemory before comparing', () => {
    const expr = ruleByName('RedisMemoryHigh')?.expr ?? '';
    expect(expr).toContain('redis_memory_max_bytes > 0');
    // clamp_min turns "no limit configured" into a ratio of millions.
    expect(expr).not.toContain('clamp_min(redis_memory_max_bytes');
  });

  it.each(['DiskSpaceLow', 'DiskSpaceCritical'])(
    '%s only considers real, writable, non-trivial filesystems',
    (name) => {
      const expr = ruleByName(name)?.expr ?? '';
      expect(expr).toContain('node_filesystem_readonly');
      expect(expr).toContain('mountpoint!~');
      // Pseudo-mounts report zero available and would otherwise always match.
      expect(expr).toMatch(/run\|sys\|proc\|dev\|host/);
      expect(expr).toContain('> 1e9');
    },
  );

  it('WebDown measures the web app by HTTP probe, not by a metrics scrape', () => {
    const expr = ruleByName('WebDown')?.expr ?? '';
    expect(expr).toContain('probe_success');
    expect(expr).not.toContain('up{job="voltx-web"}');
  });

  it('no scrape job treats the Next.js app as a metrics target', () => {
    const jobs = (prometheus.scrape_configs ?? []).map((job) => job.job_name);
    expect(jobs).not.toContain('voltx-web');
    expect(jobs).toContain('blackbox-internal');
  });
});
