import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:voltx_mobile/theme/app_theme.dart';
import 'package:voltx_mobile/theme/components/voltx_button.dart';
import 'package:voltx_mobile/theme/components/voltx_card.dart';
import 'package:voltx_mobile/theme/components/voltx_chip.dart';
import 'package:voltx_mobile/theme/extensions/voltx_colors_extension.dart';
import 'package:voltx_mobile/theme/extensions/voltx_motion_extension.dart';
import 'package:voltx_mobile/theme/extensions/voltx_radii_extension.dart';
import 'package:voltx_mobile/theme/extensions/voltx_shadows_extension.dart';
import 'package:voltx_mobile/theme/tokens/radius_tokens.dart';
import 'package:voltx_mobile/theme/tokens/spacing.dart';

void main() {
  group('Design tokens', () {
    test('spacing follows 8pt grid', () {
      expect(AppSpacing.xs, 8);
      expect(AppSpacing.sm, 16);
      expect(AppSpacing.md, 24);
      expect(AppSpacing.lg, 32);
    });

    test('radius tokens are ordered', () {
      expect(RadiusTokens.sm, lessThan(RadiusTokens.md));
      expect(RadiusTokens.md, lessThan(RadiusTokens.lg));
    });
  });

  group('Theme extensions', () {
    test('light theme registers Voltx extensions', () {
      final theme = AppTheme.light();

      expect(theme.extension<VoltxColorsExtension>(), VoltxColorsExtension.light);
      expect(theme.extension<VoltxRadiiExtension>(), VoltxRadiiExtension.standard);
      expect(theme.extension<VoltxMotionExtension>(), VoltxMotionExtension.standard);
      expect(theme.extension<VoltxShadowsExtension>(), isNotNull);
    });

    test('dark theme registers Voltx extensions', () {
      final theme = AppTheme.dark();

      expect(theme.extension<VoltxColorsExtension>(), VoltxColorsExtension.dark);
      expect(theme.brightness, Brightness.dark);
    });

    test('color extension lerps between themes', () {
      const light = VoltxColorsExtension.light;
      const dark = VoltxColorsExtension.dark;

      final mid = light.lerp(dark, 0.5);
      expect(mid.textPrimary, isNot(equals(light.textPrimary)));
    });
  });

  group('Design components', () {
    testWidgets('VoltxButton renders label', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light(),
          home: Scaffold(
            body: VoltxButton(
              label: 'Continue',
              onPressed: () {},
            ),
          ),
        ),
      );

      expect(find.text('Continue'), findsOneWidget);
    });

    testWidgets('VoltxChip shows selected state', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light(),
          home: const Scaffold(
            body: VoltxChip(label: 'Active', selected: true),
          ),
        ),
      );

      expect(find.text('Active'), findsOneWidget);
    });

    testWidgets('VoltxCard renders child content', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: AppTheme.light(),
          home: const Scaffold(
            body: VoltxCard(child: Text('Card content')),
          ),
        ),
      );

      expect(find.text('Card content'), findsOneWidget);
    });
  });
}
