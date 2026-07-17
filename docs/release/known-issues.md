# Known Issues (as of VT-030)

> A later full-repo production audit (2026-07-17) fixed several gaps this
> file used to list and refreshed the stale test counts in
> `production-checklist.md` (that doc's "last run, this session" section
> was still showing VT-030's 348/119 numbers well after the suite had grown
> past 1200 backend tests). See "Resolved in the 2026-07-17 production
> audit" below — everything else in this file is unchanged from VT-030 and
> wasn't re-verified on that date.

## Resolved in the 2026-07-17 production audit
- **Notifications preferences endpoint was completely broken**: `UpdateNotificationPreferencesDto.preferences` had no `class-validator` decorator, so the global `whitelist`+`forbidNonWhitelisted` `ValidationPipe` stripped/rejected it — `PATCH /notifications/preferences` returned 400 for every real caller. Found via writing the module's first tests (it had zero before this). Fixed: `backend/src/modules/notifications/dto/notification.dto.ts`.
- **Notification list ordering was nondeterministic** for rows created in the same millisecond (`orderBy` had no tiebreak after `createdAt`). Added an `id` tiebreak, matching the pattern already used in `audit.repository.ts`.
- **CI never ran `packages/cli` or the 3 SDKs' test suites** despite each having real tests. Added 4 CI jobs; a regression in any of them is no longer invisible.
- **`deploy.yml` raced `ci.yml`** — both triggered off the same `push` event with no ordering guarantee, so a commit whose CI failed could still deploy. Switched to `workflow_run`, gated on `ci.yml`'s `conclusion == 'success'`.
- **CI's mobile build never validated the actual production entrypoint** — `flutter build macos --release` built the default `lib/main.dart`, which resolves its API URL via `--dart-define` and falls back to `localhost`, not the `main_production.dart` flavor a real release ships. Fixed with `-t lib/main_production.dart`.
- **N+1 query** on the platform-admin organization list (`platform-organization.service.ts`) and an **unbounded query** on the Compliance Center's audit export (`audit.repository.ts`) — both fixed (single `groupBy`; keyset-paginated batches with a safety cap, respectively).
- **6 mobile features had zero tests** despite real repository/provider logic: compliance, security, integrations, knowledge, notifications, organizations. Added model-parsing and error-mapping coverage for each (`apps/mobile/test/{compliance,security,integrations,knowledge,notifications,organizations}/`).
- **2 backend modules had zero tests**: `notifications` and `reference-data` (the latter is where the notification preferences bug and ordering bug above were caught).

## Resolved this cycle (VT-030) — the two biggest gaps from VT-029 are now closed
- **Team invitation system**: fully built and live-tested. Invite by email + role, preview, accept (new account or existing account), expire (7 days), revoke, resend, RBAC (`organization.invite` permission, owner role excluded from grant), audit logs. Backend: `backend/src/modules/organization/invitations/`. Mobile: `apps/mobile/lib/features/organizations/`.
- **Organization switcher**: fully built. Switch active org without logging out (`POST /auth/switch-organization`), list memberships (`GET /auth/my-organizations`), and every organization-scoped Riverpod provider (sales, AI, knowledge, workflows, integrations, dashboard) is invalidated and refetched on switch via `invalidateOrganizationScopedProviders`.
- **Deep linking**: added from scratch (`app_links` package, `voltx://` scheme registered on macOS/iOS/Android). Live-verified on a real iOS simulator, including a cold-start bug that was found and fixed (see below).

## Fixed this cycle (VT-030)
- **Cold-start deep link crash**: opening `voltx://invitations/accept?token=...` while the app was not already running threw `GoException: no routes for location: voltx://...` — the OS delivers the raw external URI to go_router's navigation channel before the `app_links` listener gets a chance to translate it. Fixed by intercepting `state.uri.scheme == 'voltx'` at the top of the router's `redirect` callback (`lib/router/app_router.dart`) and rewriting it there, which is more robust than relying solely on the separate `DeepLinkService` listener (kept for the warm-start case). Verified live on a real iOS simulator: invalid token → correct error state with retry; real invitation token → correct preview + new-account form, rendered with real backend data.
- **Android release build failure**: `Product Flavor development contains custom resource values, but the feature is disabled` — the per-flavor `resValue("string", "app_name", ...)` calls added in VT-028 needed `buildFeatures { resValues = true }` explicitly enabled in `android/app/build.gradle.kts` (a newer AGP default). Fixed; `flutter build apk --release --flavor production` now succeeds (61.1MB).

## Missing capabilities (not bugs — intentionally not built, since building them would be a new feature)
- **No file storage abstraction.** Nothing in the product currently uploads or stores arbitrary files, so none was built speculatively.
- **Certificate pinning is prepared but inactive.** The Dio adapter hook exists (`lib/core/network/certificate_pinning.dart`) but has no real fingerprints to pin against — activate once the production API's TLS certificate is known.

## Open, lower-priority
- **iOS build flavors are not real Xcode schemes.** Android has genuine Gradle product flavors (verified building); iOS only has the Dart entrypoint files (`lib/main_production.dart` etc.) — `flutter build ios --flavor production` fails because no "production"/"staging"/"development" Xcode scheme exists. The unflavored `flutter build ios --release` build itself works and was verified on a real simulator. Creating real iOS schemes needs to be done via Xcode's GUI (duplicate + rename the Runner scheme per environment) rather than hand-edited in the `.pbxproj`, which risks corrupting the project file if scripted blind.
- **No Android device/emulator available in this environment** to install and runtime-verify the APK — the release build itself was confirmed successful (61.1MB, correct signing fallback to debug keystore), but push/streaming/secure-storage behavior on Android is unverified beyond static review. iOS got full runtime verification via simulator; Android did not.
- Dark-theme `textTertiary` color token computes to ~4.16:1 contrast, just under WCAG AA's 4.5:1 for normal text. Flagged, not changed — it's a shared token affecting many surfaces and needs visual QA, not a one-line fix.
- No automated regression test for the auth-interceptor string-interpolation bug fixed in VT-029, or the deep-link cold-start bug fixed in VT-030 — both were verified via live/manual testing instead. Worth proper automated regression coverage (a mocked-Dio interceptor test; a widget/integration test driving `GoRouter.redirect` with a raw scheme URI).
- Live AI-agent behavior (streaming, multi-agent coordination, memory capture, actual model responses) is only verified via the existing passing e2e/unit test suite — no real AI provider API key has been available in this environment across VT-029 or VT-030 to do a live model call. The verification suite is otherwise ready (agents can be created and run through the full AI Gateway pipeline); supply `OPENAI_API_KEY`/`OPENAI_ENABLED=true` (or Anthropic/Google equivalent) and re-run the same live-testing approach used for auth/invitations in this cycle (register a user, create an agent, send a real message, check streaming/memory/tool-calling) before beta.
