import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'voltx_app.dart';

/// Initializes bindings and launches the Voltx application shell.
Future<void> bootstrap() async {
  WidgetsFlutterBinding.ensureInitialized();

  runApp(
    const ProviderScope(
      child: VoltxApp(),
    ),
  );
}
