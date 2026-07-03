import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:voltx_mobile/config/app_config.dart';
import 'package:voltx_mobile/app/voltx_app.dart';
import 'package:voltx_mobile/shared/providers/connectivity_provider.dart';
import 'package:voltx_mobile/shared/widgets/empty_state.dart';
import 'package:voltx_mobile/shared/widgets/error_screen.dart';
import 'package:voltx_mobile/shared/widgets/loading_screen.dart';
import 'package:voltx_mobile/shared/widgets/offline_banner.dart';
import 'package:voltx_mobile/shared/widgets/responsive_layout.dart';
import 'package:voltx_mobile/theme/app_theme.dart';
import 'package:voltx_mobile/theme/tokens/color_tokens.dart';
import 'package:voltx_mobile/theme/tokens/spacing.dart';

void main() {
  group('AppTheme', () {
    test('light theme uses Material 3', () {
      final theme = AppTheme.light();
      expect(theme.useMaterial3, isTrue);
      expect(theme.colorScheme.primary, ColorTokens.brandPrimary);
    });

    test('dark theme uses Material 3', () {
      final theme = AppTheme.dark();
      expect(theme.useMaterial3, isTrue);
      expect(theme.brightness, Brightness.dark);
    });
  });

  group('AppSpacing', () {
    test('spacing scale follows 8pt grid', () {
      expect(AppSpacing.xs, 8);
      expect(AppSpacing.md, 24);
      expect(AppSpacing.xxxl, 64);
    });
  });

  group('AppBreakpoint', () {
    test('fromWidth returns correct breakpoint', () {
      expect(AppBreakpoint.fromWidth(400), AppBreakpoint.compact);
      expect(AppBreakpoint.fromWidth(800), AppBreakpoint.medium);
      expect(AppBreakpoint.fromWidth(1200), AppBreakpoint.expanded);
    });
  });

  group('Foundation widgets', () {
    testWidgets('LoadingScreen shows message and indicator', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light(),
          home: const LoadingScreen(message: 'Please wait'),
        ),
      );

      expect(find.text('Please wait'), findsOneWidget);
      expect(find.byType(CircularProgressIndicator), findsOneWidget);
    });

    testWidgets('ErrorScreen shows retry button when onRetry provided', (tester) async {
      var retried = false;

      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light(),
          home: ErrorScreen(
            title: 'Failed',
            message: 'Try again later',
            onRetry: () => retried = true,
          ),
        ),
      );

      expect(find.text('Failed'), findsOneWidget);
      await tester.tap(find.text('Try again'));
      await tester.pump();
      expect(retried, isTrue);
    });

    testWidgets('EmptyState renders title and action', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light(),
          home: Scaffold(
            body: EmptyState(
              title: 'No data',
              actionLabel: 'Reload',
              onAction: () {},
            ),
          ),
        ),
      );

      expect(find.text('No data'), findsOneWidget);
      expect(find.text('Reload'), findsOneWidget);
    });

    testWidgets('OfflineBanner hidden when online', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            networkStatusProvider.overrideWithValue(NetworkStatus.online),
          ],
          child: MaterialApp(
            theme: AppTheme.light(),
            home: const Scaffold(
              body: OfflineBanner(),
            ),
          ),
        ),
      );

      expect(find.textContaining('offline'), findsNothing);
    });

    testWidgets('OfflineBanner visible when offline', (tester) async {
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            networkStatusProvider.overrideWithValue(NetworkStatus.offline),
          ],
          child: MaterialApp(
            theme: AppTheme.light(),
            home: const Scaffold(
              body: OfflineBanner(),
            ),
          ),
        ),
      );

      expect(find.textContaining('offline'), findsOneWidget);
    });

    testWidgets('ResponsiveLayout applies padding', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light(),
          home: const Scaffold(
            body: ResponsiveLayout(
              child: Text('Content'),
            ),
          ),
        ),
      );

      expect(find.text('Content'), findsOneWidget);
    });
  });

  group('VoltxApp', () {
    testWidgets('renders splash screen on launch', (tester) async {
      await tester.pumpWidget(
        const ProviderScope(
          child: VoltxApp(),
        ),
      );

      expect(find.text('Voltx'), findsOneWidget);
      expect(find.byType(LinearProgressIndicator), findsOneWidget);

      await tester.pump(AppConfig.splashDuration);
      await tester.pumpAndSettle();

      expect(find.text('Power your operations\nwith Voltx'), findsOneWidget);
    });
  });
}
