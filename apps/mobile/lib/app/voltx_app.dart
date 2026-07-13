import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../config/app_config.dart';
import '../core/deep_links/deep_link_service.dart';
import '../router/app_router.dart';
import '../theme/theme_providers.dart';

/// Root application widget configured with Riverpod and GoRouter.
class VoltxApp extends HookConsumerWidget {
  const VoltxApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    final darkTheme = ref.watch(darkThemeProvider);

    useEffect(() {
      final deepLinkService = DeepLinkService(router);
      deepLinkService.start();
      return deepLinkService.dispose;
    }, [router]);

    return MaterialApp.router(
      title: AppConfig.appName,
      debugShowCheckedModeBanner: false,
      // Single black & gold theme, always — no light-mode palette is
      // designed (see theme/tokens/color_tokens.dart), so the app is
      // permanently dark rather than following system/user preference.
      themeMode: ThemeMode.dark,
      theme: darkTheme,
      darkTheme: darkTheme,
      routerConfig: router,
    );
  }
}
