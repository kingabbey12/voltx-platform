import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:voltx_mobile/features/auth/data/models/auth_user.dart';
import 'package:voltx_mobile/features/auth/presentation/providers/auth_providers.dart';
import 'package:voltx_mobile/features/dashboard/presentation/shell/dashboard_shell.dart';
import 'package:voltx_mobile/router/routes.dart';
import 'package:voltx_mobile/theme/app_theme.dart';

void main() {
  group('Dashboard shell', () {
    testWidgets('Dashboard auth session renders user name', (tester) async {
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
            home: Scaffold(
              body: Consumer(
                builder: (context, ref, _) {
                  final session = ref.watch(authSessionProvider);
                  return Text(session?.firstName ?? 'Unknown');
                },
              ),
            ),
          ),
        ),
      );

      expect(find.text('Demo'), findsOneWidget);
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
                builder: (context, state) => const SizedBox.shrink(),
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

      await tester.pump(const Duration(milliseconds: 350));

      expect(find.text('Dashboard'), findsWidgets);
      expect(find.text('AI'), findsOneWidget);
    });

    testWidgets('tapping the mobile menu icon opens the drawer', (tester) async {
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
                builder: (context, state) => const SizedBox.shrink(),
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

      await tester.pump(const Duration(milliseconds: 350));

      expect(find.byIcon(Icons.menu_rounded), findsOneWidget);
      await tester.tap(find.byIcon(Icons.menu_rounded));
      await tester.pumpAndSettle();

      expect(find.byType(Drawer), findsOneWidget);
    });
  });
}
