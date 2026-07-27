// k6 load profile for Voltx. Run with:
//   docker run --rm -i --network deploy_voltx -e BASE_URL=http://api:3000 \
//     grafana/k6 run - < perf/load-test.js
//
// Exercises unauthenticated, cheap endpoints only. The goal is to characterise
// the HTTP tier, the readiness path (which touches Postgres AND Redis on every
// call) and the process under concurrency — not to benchmark business logic,
// which would need seeded tenants and tokens.
import http from 'k6/http';
import { check } from 'k6';

const BASE = __ENV.BASE_URL || 'http://api:3000';

export const options = {
  scenarios: {
    // Ramp to a sustained plateau to find steady-state throughput.
    load: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '20s', target: 25 },
        { duration: '40s', target: 25 },
        { duration: '10s', target: 0 },
      ],
      gracefulRampDown: '5s',
    },
  },
  thresholds: {
    // Deliberately loose: this run establishes a baseline, it does not assert
    // an SLO we have not yet agreed.
    http_req_failed: ['rate<0.05'],
  },
};

export default function () {
  // readiness is the expensive one: it round-trips Postgres and Redis.
  const r = http.get(`${BASE}/readiness`);
  check(r, { 'readiness 200': (res) => res.status === 200 });

  const l = http.get(`${BASE}/liveness`);
  check(l, { 'liveness 200': (res) => res.status === 200 });
}
