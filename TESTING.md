# Testing

## Canonical end-to-end command

```bash
docker compose --profile test run --rm e2e
```

It starts the deterministic local dependency stack, applies migrations, runs both seed sets, and executes e2e tests inside the Docker network.

## Host commands

```bash
(cd backend && pnpm lint && pnpm exec tsc --noEmit && pnpm test && pnpm build)
(cd apps/web && npm run lint && npx tsc --noEmit && NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api/v1 npm run build)
```

Unit tests mock network boundaries; no test requires public DNS, internet access, or cloud credentials.
