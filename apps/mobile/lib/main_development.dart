import 'app/bootstrap.dart';
import 'config/env_config.dart';
import 'config/environment.dart';
import 'core/observability/crash_reporting.dart';

/// Development flavor entrypoint — always talks to the local dev API
/// regardless of `--dart-define` flags. Build with:
/// `flutter build macos --debug -t lib/main_development.dart`
Future<void> main() => runWithCrashReporting(
      () => bootstrap(
        envConfig: EnvConfig(
          environment: AppEnvironment.development,
          apiBaseUrl: AppEnvironment.development.defaultApiBaseUrl,
          enableNetworkLogging: true,
        ),
      ),
    );
