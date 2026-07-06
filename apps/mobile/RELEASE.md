# Release engineering

## Versioning

`pubspec.yaml`'s `version:` field is `<semver>+<build number>` (e.g. `1.0.0+1`).

- Bump the **semver** part (`major.minor.patch`) for user-facing changes, following standard semver rules.
- Bump the **build number** (the integer after `+`) on every release build submitted to a store or
  distributed to testers — it must be monotonically increasing per platform, even across semver versions
  that don't change. CI should bump it automatically (e.g. from the CI run number) rather than relying on
  a manually-edited `pubspec.yaml`.
- The build number is what Android (`versionCode`) and iOS/macOS (`CFBundleVersion`) actually use to decide
  if a build is "newer" — the semver string alone does not gate updates on any platform.

## Build flavors

Three environments: `development`, `staging`, `production`. Each has a dedicated Dart entrypoint
(`lib/main_development.dart`, `lib/main_staging.dart`, `lib/main_production.dart`) that pins the app to
its environment's API base URL via `bootstrap(envConfig: ...)` — this is intentional and stronger than
relying on `--dart-define=APP_ENV=...` alone, because it means *which entrypoint you compiled* guarantees
which backend a build talks to; it can't be silently misconfigured by a missing command-line flag.

```
flutter build macos --release -t lib/main_production.dart --dart-define=SENTRY_DSN=<production dsn>
flutter build macos --release -t lib/main_staging.dart
flutter run -t lib/main_development.dart
```

`lib/main.dart` (the default entrypoint, used by `flutter test`/`flutter build macos --release` with no
`-t` flag) still falls back to dart-define resolution (`EnvConfig.fromEnvironment()`), for local
development convenience and because the test suite instantiates the app without going through any of the
flavor entrypoints.

**Android**: real Gradle product flavors exist (`android/app/build.gradle.kts`) — `development`/`staging`/
`production`, each with a distinct `applicationIdSuffix` and app name (via `resValue`), so all three can be
installed on one device simultaneously. Building an Android artifact now requires `--flavor <name>` (e.g.
`flutter build apk --release --flavor production -t lib/main_production.dart`) — this was not previously
required since no flavors existed; any existing build script must be updated accordingly. **Not verified
in this environment** (no Android SDK/build performed here) — verify on a machine with the Android
toolchain before relying on it.

**iOS/macOS**: intentionally *not* implemented as separate Xcode schemes/build configurations in this pass.
Those files (`ios/Runner.xcodeproj/project.pbxproj`, `macos/Runner.xcodeproj/project.pbxproj`) are
Xcode-generated and easy to corrupt via blind text edits with no Xcode GUI available here to verify the
result — a broken `.pbxproj` can silently break every build. The Dart-entrypoint approach above works
today on macOS/iOS without touching those files; true per-flavor bundle IDs/app icons on Apple platforms
still need an engineer to add build configurations/schemes in Xcode itself.

## Release signing

- **Android**: `android/app/build.gradle.kts` reads `android/key.properties` (gitignored, never committed)
  if present and signs release builds with it; falls back to the debug keystore when absent, so
  `flutter build apk --release --flavor production` keeps working with no keystore configured. Copy
  `android/key.properties.example` to `android/key.properties` and fill in a real upload keystore to
  produce a store-signable build.
- **iOS/macOS**: needs an Apple Developer Program signing identity + provisioning profile, configured via
  Xcode (`ios/Runner.xcworkspace` / `macos/Runner.xcworkspace`) or a `Fastfile`/`ExportOptions.plist` in a
  CI signing step. Nothing to prepare from pure text-file changes here — this is an account/credential
  dependency outside this repo.

## Crash reporting

`sentry_flutter` is wired in `lib/core/observability/crash_reporting.dart`, gated entirely by
`--dart-define=SENTRY_DSN=...`. Empty/absent (the default for `flutter test`, CI, and local dev) means the
Sentry SDK is never touched at runtime — `main.dart`/the flavor entrypoints just call `bootstrap()`
directly. Supply a real DSN only on release builds.

## Analytics

`lib/core/analytics/analytics_service.dart` defines a provider-agnostic `AnalyticsService` interface,
defaulting to a no-op implementation (`analyticsServiceProvider`). Three call sites are wired as examples
of the intended usage: sign-in success, sign-up success, first AI message sent per conversation turn. Swap
the provider override to a real backend (Firebase/Amplitude/PostHog/etc.) when one is chosen — no call
site changes needed.

## Certificate pinning

Prepared but off by default in `lib/core/network/certificate_pinning.dart` — see that file's doc comment
for the exact gap that must be closed (dart:io's `badCertificateCallback` only fires for certs that fail
normal trust-chain validation, so this isn't yet *true* pinning against a validly-signed-but-wrong cert).
Needs the production API's real certificate fingerprint before it's meaningful to finish.
