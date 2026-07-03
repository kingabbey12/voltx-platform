import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../auth/presentation/providers/auth_providers.dart';
import '../../../../theme/components/voltx_card.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';

/// User profile screen with session info.
class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authSessionProvider);
    final colors = context.voltxColors;
    final scheme = Theme.of(context).colorScheme;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Profile', style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: AppSpacing.lg),
          VoltxCard(
            child: Row(
              children: [
                CircleAvatar(
                  radius: 36,
                  backgroundColor: scheme.primary.withValues(alpha: 0.12),
                  child: Text(
                    user?.firstName.substring(0, 1).toUpperCase() ?? 'V',
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                          color: scheme.primary,
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        user?.displayName ?? 'Voltx Executive',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 4),
                      Text(
                        user?.email ?? 'demo@voltx.io',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: colors.textSecondary,
                            ),
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                        decoration: BoxDecoration(
                          color: user?.emailVerified == true
                              ? colors.successSurface
                              : colors.warningSurface,
                          borderRadius: BorderRadius.circular(999),
                        ),
                        child: Text(
                          user?.emailVerified == true ? 'Verified' : 'Unverified',
                          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                color: user?.emailVerified == true
                                    ? colors.success
                                    : colors.warning,
                                fontWeight: FontWeight.w600,
                              ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          Text('Role', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: AppSpacing.xs),
          VoltxCard(
            child: ListTile(
              leading: const Icon(Icons.shield_outlined),
              title: const Text('Executive Administrator'),
              subtitle: Text(
                'Full access to operations dashboard',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: colors.textSecondary,
                    ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
