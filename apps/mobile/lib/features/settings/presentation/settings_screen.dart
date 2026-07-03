import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../shared/widgets/responsive_layout.dart';
import '../../../theme/components/voltx_navigation.dart';
import '../../../theme/theme_providers.dart';
import '../../../theme/tokens/spacing.dart';
import '../../../theme/voltx_theme.dart';

/// App settings including theme mode selection.
class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final themeMode = ref.watch(themeModeProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: ResponsiveLayout(
        child: ListView(
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
          children: [
            Text(
              'Appearance',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: AppSpacing.xs),
            VoltxSegmentedControl<ThemeMode>(
              segments: const {
                ThemeMode.system: Text('System'),
                ThemeMode.light: Text('Light'),
                ThemeMode.dark: Text('Dark'),
              },
              selected: {themeMode},
              onSelectionChanged: (selection) {
                ref.read(themeModeProvider.notifier).state = selection.first;
              },
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(
              'About',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: AppSpacing.xs),
            Card(
              child: ListTile(
                leading: const Icon(Icons.info_outline_rounded),
                title: const Text('Voltx Design System'),
                subtitle: Text(
                  'Version 1.0.0 — Apple + Linear',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: context.voltxColors.textSecondary,
                      ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
