import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../features/auth/presentation/providers/auth_providers.dart';
import 'voltx_app.dart';

/// Initializes bindings and launches the Voltx application shell.
Future<void> bootstrap() async {
  WidgetsFlutterBinding.ensureInitialized();

  final container = ProviderContainer();
  debugPrint('[AUTH][BOOTSTRAP] restoreSession_begin');
  await container.read(authSessionProvider.notifier).restoreSession();
  debugPrint('[AUTH][BOOTSTRAP] restoreSession_end');

  runApp(
    UncontrolledProviderScope(
      container: container,
      child: const VoltxApp(),
    ),
  );
}
