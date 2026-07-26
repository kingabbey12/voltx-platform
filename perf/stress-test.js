// Stress + spike profile: ramps well past the comfortable plateau to locate
// the point where latency degrades or errors appear, then hits a hard spike.
import http from 'k6/http';
import { check } from 'k6';
const BASE = __ENV.BASE_URL || 'http://api:3000';
export const options = {
  scenarios: {
    stress: {
      executor: 'ramping-vus',
      startVUs: 10,
      stages: [
        { duration: '20s', target: 100 },
        { duration: '20s', target: 250 },
        { duration: '20s', target: 500 },
        { duration: '15s', target: 0 },
      ],
      gracefulRampDown: '5s',
    },
  },
  // p99 is what we actually want to characterise here.
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};
export default function () {
  const r = http.get(`${BASE}/readiness`);
  check(r, { ok: (res) => res.status === 200 });
}
