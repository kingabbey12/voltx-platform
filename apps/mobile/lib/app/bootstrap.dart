import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/env_config.dart';
import '../core/network/network_providers.dart';
import '../features/auth/presentation/providers/auth_providers.dart';
import 'voltx_app.dart';

/// Initializes bindings and launches the Voltx application shell.
///
/// [envConfig], when supplied, pins the app to a specific environment
/// regardless of `--dart-define=APP_ENV=...` — this is what the
/// `main_development.dart`/`main_staging.dart`/`main_production.dart`
/// flavor entrypoints use, so which backend a build talks to is guaranteed
/// by which entrypoint was compiled, not by remembering to pass a flag.
/// The default `main.dart` entrypoint leaves this null and falls back to
/// dart-define resolution (`EnvConfig.fromEnvironment()`).
Future<void> bootstrap({EnvConfig? envConfig}) async {
  WidgetsFlutterBinding.ensureInitialized();

  final container = ProviderContainer(
    overrides: [
      if (envConfig != null) envConfigProvider.overrideWithValue(envConfig),
    ],
  );
  // Fire the session restore without blocking first paint — AuthSplashScreen
  // shows immediately and the router re-evaluates its redirect once the
  // session resolves (see authSessionProvider listener in app_router.dart).
  unawaited(container.read(authSessionProvider.notifier).restoreSession());

  runApp(
    UncontrolledProviderScope(
      container: container,
      child: const VoltxApp(),
    ),
  );
}
