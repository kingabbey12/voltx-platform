import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../config/app_config.dart';
import '../../../router/routes.dart';
import '../../../shared/widgets/loading_screen.dart';

/// Branded splash screen that transitions into the app shell.
class SplashScreen extends HookConsumerWidget {
  const SplashScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    useEffect(() {
      final timer = Timer(AppConfig.splashDuration, () {
        if (context.mounted) {
          context.go(AppRoutes.home);
        }
      });
      return timer.cancel;
    }, const []);

    return const Scaffold(
      body: SafeArea(
        child: Center(
          child: SplashLoadingContent(),
        ),
      ),
    );
  }
}
