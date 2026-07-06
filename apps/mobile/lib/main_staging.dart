import 'app/bootstrap.dart';
import 'config/env_config.dart';
import 'config/environment.dart';
import 'core/observability/crash_reporting.dart';

/// Staging flavor entrypoint — always talks to the staging API regardless
/// of `--dart-define` flags. Build with:
/// `flutter build macos --release -t lib/main_staging.dart`
Future<void> main() => runWithCrashReporting(
      () => bootstrap(
        envConfig: EnvConfig(
          environment: AppEnvironment.staging,
          apiBaseUrl: AppEnvironment.staging.defaultApiBaseUrl,
          enableNetworkLogging: true,
        ),
      ),
    );
