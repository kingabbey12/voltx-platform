import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:voltx_mobile/theme/app_theme.dart';
import 'package:voltx_mobile/theme/components/voltx_selector_field.dart';

void main() {
  Widget wrap(Widget child) {
    return MaterialApp(
      theme: AppTheme.light(),
      home: Scaffold(body: child),
    );
  }

  group('VoltxSelectorField', () {
    testWidgets('shows the placeholder when no value is selected', (tester) async {
      await tester.pumpWidget(
        wrap(
          VoltxSelectorField(
            label: 'Industry',
            placeholder: 'Select an industry',
            valueText: null,
            onTap: () async {},
          ),
        ),
      );

      expect(find.text('Select an industry'), findsOneWidget);
      expect(find.text('Industry'), findsOneWidget);
    });

    testWidgets('shows the selected value instead of the placeholder', (tester) async {
      await tester.pumpWidget(
        wrap(
          VoltxSelectorField(
            label: 'Industry',
            placeholder: 'Select an industry',
            valueText: 'Software / SaaS',
            onTap: () async {},
          ),
        ),
      );

      expect(find.text('Software / SaaS'), findsOneWidget);
      expect(find.text('Select an industry'), findsNothing);
    });

    testWidgets('invokes onTap when tapped while enabled', (tester) async {
      var tapped = false;
      await tester.pumpWidget(
        wrap(
          VoltxSelectorField(
            label: 'Industry',
            valueText: null,
            onTap: () async {
              tapped = true;
            },
          ),
        ),
      );

      await tester.tap(find.byType(InkWell));
      await tester.pumpAndSettle();

      expect(tapped, isTrue);
    });

    testWidgets('does not invoke onTap when disabled', (tester) async {
      var tapped = false;
      await tester.pumpWidget(
        wrap(
          VoltxSelectorField(
            label: 'Industry',
            valueText: null,
            enabled: false,
            onTap: () async {
              tapped = true;
            },
          ),
        ),
      );

      await tester.tap(find.byType(InkWell), warnIfMissed: false);
      await tester.pumpAndSettle();

      expect(tapped, isFalse);
    });

    testWidgets('renders the error text when provided', (tester) async {
      await tester.pumpWidget(
        wrap(
          VoltxSelectorField(
            label: 'Industry',
            valueText: null,
            errorText: 'Select an industry',
            onTap: () async {},
          ),
        ),
      );

      expect(find.text('Select an industry'), findsOneWidget);
    });
  });
}
