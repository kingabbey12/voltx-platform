import 'app/bootstrap.dart';
import 'config/env_config.dart';
import 'config/environment.dart';
import 'core/observability/crash_reporting.dart';

/// Production flavor entrypoint — always talks to the production API
/// regardless of `--dart-define` flags, so a production build can never
/// accidentally ship pointed at a dev/staging backend. Build with:
/// `flutter build macos --release -t lib/main_production.dart`
/// (pass `--dart-define=SENTRY_DSN=...` alongside to enable crash
/// reporting for this build).
Future<void> main() => runWithCrashReporting(
      () => bootstrap(
        envConfig: EnvConfig(
          environment: AppEnvironment.production,
          apiBaseUrl: AppEnvironment.production.defaultApiBaseUrl,
          enableNetworkLogging: false,
        ),
      ),
    );
