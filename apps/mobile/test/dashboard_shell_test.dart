import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:voltx_mobile/features/auth/data/models/auth_user.dart';
import 'package:voltx_mobile/features/auth/presentation/providers/auth_providers.dart';
import 'package:voltx_mobile/features/dashboard/presentation/screens/executive_dashboard_screen.dart';
import 'package:voltx_mobile/features/dashboard/presentation/shell/dashboard_shell.dart';
import 'package:voltx_mobile/router/routes.dart';
import 'package:voltx_mobile/theme/app_theme.dart';

void main() {
  group('Dashboard shell', () {
    testWidgets('ExecutiveDashboardScreen shows greeting and KPIs', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            authSessionProvider.overrideWith(
              (ref) => AuthSessionNotifier(ref.watch(authRepositoryProvider))
                ..setUser(
                  const AuthUser(
                    id: '1',
                    email: 'demo@voltx.io',
                    firstName: 'Demo',
                    lastName: 'User',
                    emailVerified: true,
                  ),
                ),
            ),
          ],
          child: MaterialApp(
            theme: AppTheme.light(),
            home: const Scaffold(body: ExecutiveDashboardScreen()),
          ),
        ),
      );

      expect(find.textContaining('Demo'), findsOneWidget);
      expect(find.text('Grid Output'), findsOneWidget);
      expect(find.text('Recent Activity'), findsOneWidget);
    });

    testWidgets('DashboardShell renders bottom nav on mobile', (tester) async {
      tester.view.physicalSize = const Size(400, 800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);

      final router = GoRouter(
        routes: [
          ShellRoute(
            builder: (context, state, child) => DashboardShell(child: child),
            routes: [
              GoRoute(
                path: AppRoutes.dashboard,
                builder: (context, state) => const ExecutiveDashboardScreen(),
              ),
            ],
          ),
        ],
        initialLocation: AppRoutes.dashboard,
      );

      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp.router(
            theme: AppTheme.light(),
            routerConfig: router,
          ),
        ),
      );

      await tester.pumpAndSettle();

      expect(find.text('Dashboard'), findsWidgets);
      expect(find.text('AI'), findsOneWidget);
    });
  });
}
