import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../features/auth/presentation/providers/auth_providers.dart';
import '../../../router/routes.dart';
import '../../../theme/tokens/spacing.dart';
import '../../../theme/voltx_theme.dart';

/// App settings.
class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Settings', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: AppSpacing.md),
            Text(
              'Workspace',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: AppSpacing.xs),
            Card(
              child: Column(
                children: [
                  ListTile(
                    leading: const Icon(Icons.lock_outline_rounded),
                    title: const Text('Security Center'),
                    subtitle: Text(
                      'Sessions, devices, MFA, API keys, and login history',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: context.voltxColors.textSecondary,
                          ),
                    ),
                    trailing: const Icon(Icons.chevron_right_rounded),
                    onTap: () => context.go(AppRoutes.securityHome),
                  ),
                ],
              ),
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
                  'Version 1.0.0',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: context.voltxColors.textSecondary,
                      ),
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            Text(
              'Account',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: AppSpacing.xs),
            Card(
              child: ListTile(
                leading: const Icon(Icons.logout_rounded),
                title: const Text('Sign out'),
                subtitle: Text(
                  'Return to the welcome screen',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: context.voltxColors.textSecondary,
                      ),
                ),
                onTap: () async {
                  await ref.read(authSessionProvider.notifier).signOut();
                  if (context.mounted) {
                    context.go(AppRoutes.welcome);
                  }
                },
              ),
            ),
        ],
      ),
    );
  }
}
