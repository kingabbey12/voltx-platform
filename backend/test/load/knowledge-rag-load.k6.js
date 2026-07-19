import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  scenarios: {
    retrieval_traffic: {
      executor: 'ramping-vus',
      startVUs: 1,
      stages: [
        { duration: '30s', target: 5 },
        { duration: '60s', target: 20 },
        { duration: '30s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<1200'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const ACCESS_TOKEN = __ENV.ACCESS_TOKEN;

if (!ACCESS_TOKEN) {
  throw new Error('ACCESS_TOKEN env var is required');
}

const headers = {
  Authorization: `Bearer ${ACCESS_TOKEN}`,
  'Content-Type': 'application/json',
};

const queries = [
  'Summarize the latest Acme pipeline blockers.',
  'What did support say about the billing outage?',
  'What is the enterprise renewal amount for Contoso?',
  'Which customers are in contract negotiation this week?',
  'What happened in last night incident runbook?',
];

export default function () {
  const query = queries[Math.floor(Math.random() * queries.length)];
  const payload = JSON.stringify({ query, topK: 8, minConfidence: 0.15 });

  const response = http.post(`${BASE_URL}/api/v1/knowledge/search`, payload, { headers });

  check(response, {
    'search status is 201': (r) => r.status === 201,
    'search has success envelope': (r) => {
      try {
        const body = r.json();
        return Boolean(body && body.success === true && body.data);
      } catch {
        return false;
      }
    },
  });

  sleep(0.3);
}
