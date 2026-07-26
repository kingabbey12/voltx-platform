// Endurance: steady moderate load for several minutes. Looks for memory growth
// and latency drift over time rather than peak capacity.
import http from 'k6/http';
import { check } from 'k6';
const BASE = __ENV.BASE_URL || 'http://api:3000';
export const options = {
  scenarios: {
    soak: { executor: 'constant-vus', vus: 50, duration: '3m' },
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};
export default function () {
  check(http.get(`${BASE}/readiness`), { ok: (r) => r.status === 200 });
}
