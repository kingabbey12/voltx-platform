import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:sentry_flutter/sentry_flutter.dart';

/// Sentry DSN supplied at build time via `--dart-define=SENTRY_DSN=...`.
/// Left empty (the default for dev/test/CI builds), crash reporting is
/// fully inert — [runWithCrashReporting] just calls [appRunner] directly
/// and never touches the Sentry SDK at runtime.
const _sentryDsn = String.fromEnvironment('SENTRY_DSN');

const _appEnv = String.fromEnvironment('APP_ENV', defaultValue: 'development');

/// Runs [appRunner] (expected to initialize bindings and call `runApp`)
/// under Sentry crash reporting when a DSN is configured, otherwise runs
/// it unmodified.
Future<void> runWithCrashReporting(FutureOr<void> Function() appRunner) async {
  if (_sentryDsn.isEmpty) {
    await appRunner();
    return;
  }

  await SentryFlutter.init(
    (options) {
      options.dsn = _sentryDsn;
      options.environment = _appEnv;
      options.tracesSampleRate = kReleaseMode ? 0.2 : 1.0;
      options.debug = !kReleaseMode;
    },
    appRunner: appRunner,
  );
}
