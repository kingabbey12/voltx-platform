# Environment

## Local Compose

The canonical Compose workflow uses the safe local defaults in `backend/.env.example`; no cloud credentials are required to start the platform. AI providers and third-party integrations are disabled until configured.

## Required backend variables

| Variable | Local value | Production source |
| --- | --- | --- |
| `DATABASE_URL` | Supplied by Compose | Managed PostgreSQL connection string |
| `JWT_ACCESS_SECRET` | Example development secret | `openssl rand -base64 48` |
| `INTEGRATIONS_ENCRYPTION_KEY` | Example development key | `openssl rand -base64 32`, stored in the secret manager |
| `REDIS_URL` | Supplied by Compose | Managed Redis connection string when `REDIS_ENABLED=true` |

The backend validates required and conditionally required values before Nest starts. An enabled AI provider requires its matching API key; an enabled OAuth integration requires its complete credential set; S3 storage requires bucket, region, and credentials.

## Web

For a host-run web app, copy `apps/web/.env.example` to `apps/web/.env.local`. Set `NEXT_PUBLIC_API_BASE_URL`; local Compose uses `http://localhost:3002/api/v1`. The web preflight exits before Next starts or builds if it is missing.

## CI and deployment secrets

CI uses disposable local credentials and needs no repository secrets. Deployment requires `DATABASE_URL` plus the runtime variables above. Add provider credentials only for integrations that are enabled: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_AI_API_KEY`, OAuth client ID/secret pairs, Stripe keys, S3 credentials, Sentry DSN, and production webhook secrets.
