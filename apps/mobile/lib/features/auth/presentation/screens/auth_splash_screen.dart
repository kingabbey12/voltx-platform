import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../config/app_config.dart';
import '../../../../router/routes.dart';
import '../../../../shared/widgets/loading_screen.dart';
import '../../../../theme/tokens/motion_tokens.dart';
import '../providers/auth_providers.dart';

/// Branded splash that routes to welcome or home when session exists.
class AuthSplashScreen extends HookConsumerWidget {
  const AuthSplashScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final controller = useAnimationController(duration: MotionTokens.slow);

    useEffect(() {
      controller.forward();
      final timer = Timer(AppConfig.splashDuration, () {
        if (!context.mounted) {
          return;
        }
        final session = ref.read(authSessionProvider);
        if (session != null) {
          context.go(AppRoutes.home);
        } else {
          context.go(AppRoutes.welcome);
        }
      });
      return timer.cancel;
    }, const []);

    final fade = CurvedAnimation(parent: controller, curve: MotionTokens.standard);
    final scale = Tween<double>(begin: 0.92, end: 1).animate(
      CurvedAnimation(parent: controller, curve: MotionTokens.spring),
    );

    return Scaffold(
      body: SafeArea(
        child: Center(
          child: FadeTransition(
            opacity: fade,
            child: ScaleTransition(
              scale: scale,
              child: const SplashLoadingContent(),
            ),
          ),
        ),
      ),
    );
  }
}
