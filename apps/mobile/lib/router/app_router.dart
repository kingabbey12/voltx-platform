import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../features/components/presentation/components_screen.dart';
import '../features/components/presentation/empty_state_screen.dart';
import '../features/components/presentation/error_state_screen.dart';
import '../features/components/presentation/loading_state_screen.dart';
import '../features/home/presentation/home_screen.dart';
import '../features/settings/presentation/settings_screen.dart';
import '../features/splash/presentation/splash_screen.dart';
import '../shared/widgets/app_shell.dart';
import 'routes.dart';

final _rootNavigatorKey = GlobalKey<NavigatorState>(debugLabel: 'root');
final _shellNavigatorKey = GlobalKey<NavigatorState>(debugLabel: 'shell');

final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    navigatorKey: _rootNavigatorKey,
    initialLocation: AppRoutes.splash,
    debugLogDiagnostics: false,
    routes: [
      GoRoute(
        path: AppRoutes.splash,
        name: 'splash',
        builder: (context, state) => const SplashScreen(),
      ),
      ShellRoute(
        navigatorKey: _shellNavigatorKey,
        builder: (context, state, child) => AppShell(child: child),
        routes: [
          GoRoute(
            path: AppRoutes.home,
            name: 'home',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: HomeScreen(),
            ),
          ),
          GoRoute(
            path: AppRoutes.components,
            name: 'components',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: ComponentsScreen(),
            ),
            routes: [
              GoRoute(
                path: 'loading',
                name: 'loading',
                builder: (context, state) => const LoadingStateScreen(),
              ),
              GoRoute(
                path: 'error',
                name: 'error',
                builder: (context, state) => const ErrorStateScreen(),
              ),
              GoRoute(
                path: 'empty',
                name: 'empty',
                builder: (context, state) => const EmptyStateScreen(),
              ),
            ],
          ),
          GoRoute(
            path: AppRoutes.settings,
            name: 'settings',
            pageBuilder: (context, state) => const NoTransitionPage(
              child: SettingsScreen(),
            ),
          ),
        ],
      ),
    ],
  );
});
