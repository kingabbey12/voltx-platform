import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:voltx_mobile/features/auth/presentation/screens/sign_in_screen.dart';
import 'package:voltx_mobile/features/auth/presentation/screens/welcome_screen.dart';
import 'package:voltx_mobile/router/routes.dart';
import 'package:voltx_mobile/theme/app_theme.dart';

void main() {
  group('Auth screens', () {
    testWidgets('WelcomeScreen shows sign in and create account actions', (tester) async {
      final router = GoRouter(
        routes: [
          GoRoute(
            path: AppRoutes.welcome,
            builder: (context, state) => const WelcomeScreen(),
          ),
          GoRoute(
            path: AppRoutes.signIn,
            builder: (context, state) => const SignInScreen(),
          ),
        ],
        initialLocation: AppRoutes.welcome,
      );

      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp.router(
            theme: AppTheme.light(),
            darkTheme: AppTheme.dark(),
            routerConfig: router,
          ),
        ),
      );

      await tester.pump(const Duration(milliseconds: 600));

      expect(find.text('Power your operations\nwith Voltx'), findsOneWidget);
      expect(find.text('Sign In'), findsOneWidget);
      expect(find.text('Create Account'), findsOneWidget);
    });

    testWidgets('WelcomeScreen renders in dark mode', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light(),
          darkTheme: AppTheme.dark(),
          themeMode: ThemeMode.dark,
          home: const WelcomeScreen(),
        ),
      );

      await tester.pump(const Duration(milliseconds: 600));

      expect(find.text('Power your operations\nwith Voltx'), findsOneWidget);
    });

    testWidgets('SignInScreen validates empty form', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            theme: AppTheme.light(),
            home: const SignInScreen(),
          ),
        ),
      );

      await tester.pump(const Duration(milliseconds: 600));
      await tester.tap(find.text('Sign In'));
      await tester.pump();

      expect(find.text('Email is required'), findsOneWidget);
      expect(find.text('Password is required'), findsOneWidget);
    });
  });
}
