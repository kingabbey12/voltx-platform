# Beta Deployment Checklist

Use this to bring up the first real beta environment. Assumes the production checklist has been reviewed.

## 1. Choose and provision hosting
- [ ] Pick a host for the backend container (ECS/Fly/Render/Kubernetes/etc.) — `deploy.yml`'s final step is a placeholder pending this decision
- [ ] Provision a managed Postgres (pgvector-capable) — do not reuse the local `docker-compose.yml` dev database
- [ ] Provision Redis if enabling the shared knowledge-embedding cache (`REDIS_ENABLED=true`) — optional for a single-instance beta, required once you run >1 backend replica

## 2. Secrets
Fill in every variable in `backend/.env.example` for the real environment, at minimum:
- [ ] `DATABASE_URL` (managed Postgres connection string)
- [ ] `JWT_ACCESS_SECRET` (long random value — `openssl rand -base64 48`, never reuse the dev value)
- [ ] At least one AI provider: `OPENAI_ENABLED`/`OPENAI_API_KEY` (or Anthropic/Google equivalents) — **without this, agent creation, chat, and any AGENT-type workflow step will correctly 503**; non-AI workflows (DELAY/API/WEBHOOK/TOOL/etc.) work fine without one
- [ ] `INTEGRATIONS_ENCRYPTION_KEY` — required before any integration connection can store credentials (currently unset in dev; logs a warning, doesn't block boot)
- [ ] `CORS_ALLOWED_ORIGINS` — set to the real web/app origins if a browser client will ever call this API directly (native mobile clients are unaffected either way)
- [ ] `SENTRY_DSN` — optional but recommended before beta traffic
- [ ] OAuth client id/secret pairs for any integration provider (Google/Microsoft/Slack/GitHub) beta users will actually connect

## 3. Database
- [ ] Run `pnpm prisma:migrate:deploy` against the target database (the `deploy.yml` `migrate-and-deploy` job does this automatically on a real deploy — verify it actually ran)
- [ ] Run `pnpm prisma:seed` once against a fresh database to populate the permissions/roles catalog (idempotent — safe to re-run)

## 4. Deploy
- [ ] Build and push the image (`deploy.yml` `build-and-push` job, or manually: `docker build --target production -t <registry>/voltx-backend:<tag> backend/`)
- [ ] Point your hosting target at the pushed image
- [ ] Confirm `/api/v1/health`, `/readiness`, `/liveness` all return 200 against the live deployment
- [ ] Confirm `/metrics` is reachable from wherever Prometheus will scrape it (and NOT publicly exposed if that matters for your network setup — it currently has no auth guard, by design for scraping simplicity)

## 5. Mobile
- [ ] Build the production flavor pointed at the real API: `flutter build macos --release -t lib/main_production.dart --dart-define=SENTRY_DSN=<dsn>` (adjust target platform as needed)
- [ ] Confirm `AppEnvironment.production.defaultApiBaseUrl` in `lib/config/environment.dart` actually points at the deployed backend's public URL
- [ ] Android/iOS flavors are configured in Gradle/xcconfig but have **not been built or verified in this environment** — do that on a machine with the relevant SDK before shipping those platforms
- [ ] Release signing: Android reads `android/key.properties` if present (see `android/key.properties.example`) — provide a real keystore before a release build is distributed; iOS/macOS need an Apple Developer signing identity supplied outside this repo

## 6. Smoke test against the live environment
Register a real test account and manually walk: sign up → confirm session has roles/permissions immediately (no restart needed) → dashboard loads → create a sales lead → open AI chat and send a message (if an AI provider is configured) → create a simple non-agent workflow and run it → invite a teammate, copy the invitation link, accept it in a second session (or on a second device via the `voltx://` deep link) → switch between organizations if the account belongs to more than one → sign out → sign back in.

## 7. Before inviting beta users
- [x] Team invitations work: invite by email + role, copy/share the link (no email-sending infra exists, so this is a manual share), accept as a new or existing account, revoke/resend.
- [ ] Confirm the invitation link's scheme (`INVITATIONS_ACCEPT_BASE_URL`, default `voltx://invitations/accept`) matches what your production mobile builds actually register — if you ship a different bundle/app ID per environment, this may need to be an environment-specific `https://` universal link instead of a bare custom scheme for reliable delivery via email/SMS.
- [ ] Communicate the known gaps in `known-issues.md` to whoever is running the beta (notably: iOS build flavors aren't real Xcode schemes yet, and Android hasn't been runtime-verified on a device/emulator)
