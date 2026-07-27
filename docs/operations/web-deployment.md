# Deploying apps/web

The authenticated business application (`app.usevoltx.com`). A stateless Next.js 15 app in standalone mode — **it owns no database, no storage bucket, no auth provider and no mail service.** Everything stateful belongs to the backend API; the web app is a client of it.

---

## The one thing to understand before deploying

**`NEXT_PUBLIC_*` values are compiled into the JavaScript bundle by `next build`.** They are build inputs, not runtime configuration.

Three consequences:

1. Setting them in compose's `environment:`, in `.env` at runtime, or in the container has **no effect on the bundle**.
2. **A web image is environment-specific.** A staging image can never be promoted to production — production must be rebuilt with production values.
3. Getting it wrong produces an app that renders perfectly and loads no data. It is not visible in lint, type-check, `next build`, or a smoke test of the page.

This is not hypothetical. Before this was fixed, the deployed image had `http://localhost:3000/api/v1` compiled in, picked up from a developer's `.env.local` via `COPY . .`, and would have pointed every user's browser at their own machine.

---

## Required configuration

| Variable | Required | Where it applies | Notes |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | **Yes** | **Build** | Public URL a *browser* can reach, including `/api/v1`. Never an internal hostname like `http://api:3000`. The build fails without it. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | No | **Build** | Publishable (non-secret) key. Unset ⇒ the payment-method page shows a clear "not configured" message instead of a broken card form. |
| `NODE_ENV` | Set by image | Runtime | `production` |
| `HOSTNAME` | Set by image | Runtime | `0.0.0.0` — the standalone server binds `127.0.0.1` otherwise and is unreachable from outside the container |
| `PORT` | Set by image | Runtime | `3000` |

**There are no other variables.** No `DATABASE_URL`, no S3 credentials, no SMTP settings, no OAuth secrets — those are all backend configuration.

### Dependencies the web app does *not* have

Verified by inspection, so nobody re-derives it during a launch:

- **Database / migrations** — none. No Prisma, no Drizzle, no driver. All migrations belong to `backend/`.
- **Object storage** — none. Attachment uploads proxy through the API.
- **Auth provider** — no NextAuth. JWTs are issued by the backend; the client stores them and the middleware gates routes.
- **Email** — none. The `resend` references in the source are *resend-invitation* API calls, not a mail client.

### Infrastructure required

- Node 22 runtime (supplied by the image)
- Network reachability from the **browser** to `NEXT_PUBLIC_API_BASE_URL`, over HTTPS in production
- WebSocket (`wss://`) to the same API origin — the live inbox uses socket.io. Proxies must not strip `Upgrade` headers.
- TLS termination (nginx in this stack)
- ~512 MB memory, 1 CPU per instance. Stateless, so it scales horizontally with no coordination.

---

## Deployment checklist

### Before the first production deploy

- [ ] `NEXT_PUBLIC_API_BASE_URL` set in `deploy/.env` to the **public** API URL over HTTPS
- [ ] Backend API is deployed and `https://<api-host>/readiness` returns 200
- [ ] DNS resolves the app and API hostnames publicly
- [ ] TLS certificate valid for the app hostname
- [ ] `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` set, or billing degradation accepted
- [ ] Backend `CORS_ALLOWED_ORIGINS` includes the app origin — otherwise every authenticated request fails in the browser

### Deploy

```bash
DEPLOY_ENV=production ./deploy/deploy.sh
```

`deploy.sh` refuses to proceed if the API URL is missing, points at `localhost`/`127.0.0.1`/an internal compose hostname, or is not HTTPS in production.

### After deploying — verify in a browser, not just with curl

- [ ] `https://<app-host>/health` returns **200 directly** (not a redirect)
- [ ] Container reports `healthy`
- [ ] Sign in succeeds and the dashboard loads **data**, not just chrome
- [ ] Browser devtools console shows **no CSP violations**
- [ ] Network tab shows XHR going to the correct API origin
- [ ] The unified inbox receives a live message (proves the WebSocket upgrade survives the proxy)

### Verify the image is what you think it is

```bash
# Confirm the compiled API URL — this is the check that would have caught
# the localhost bug.
docker run --rm --entrypoint sh voltx-web:latest -c \
  "grep -rhoE 'https?://[^\"]*api[^\"]*' .next/static/chunks/*.js | sort -u | head"

# Confirm no env file was baked into a layer.
docker run --rm --entrypoint sh voltx-web:latest -c "ls -a | grep -c '^\.env'"   # expect 0
```

---

## Rollback

The web tier is stateless, so rollback is purely an image swap and needs no data restore:

```bash
docker tag voltx-web:previous voltx-web:latest
docker compose -f deploy/docker-compose.yml --env-file deploy/.env up -d --force-recreate web
```

`deploy.sh` tags the outgoing image `:previous` before every build. **`--force-recreate` is required** — without it compose sees no config change and leaves the old container running. Verified by drill: 3 seconds to recovery.

---

## Known limitations

- **Deploys cause a brief interruption.** Single replica; compose stops the old container before starting the new one.
- **Refresh tokens are stored in `localStorage`.** Documented trade-off (no BFF proxy layer); an XSS would yield a durable credential. Mitigated by CSP, `nosniff`, and short access-token lifetime.
- **`connect-src` is derived from the build-time API URL.** Pointing the app at a second API host at runtime is not possible without a rebuild — by design.
