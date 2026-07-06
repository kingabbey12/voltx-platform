import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../router/routes.dart';
import '../../../auth/data/models/auth_organization_membership.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../../../shared/widgets/async_value_view.dart';
import '../../../../theme/components/voltx_button.dart';
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
                        user?.email ?? 'No active session',
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
          const SizedBox(height: AppSpacing.lg),
          Text('Organizations', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: AppSpacing.xs),
          const _OrganizationSwitcherCard(),
          if (user?.permissions.contains('organization.invite') ?? false) ...[
            const SizedBox(height: AppSpacing.md),
            VoltxButton(
              label: 'Manage team',
              icon: Icons.group_add_outlined,
              variant: VoltxButtonVariant.secondary,
              isExpanded: true,
              onPressed: () => context.push(AppRoutes.manageTeam),
            ),
          ],
        ],
      ),
    );
  }
}

class _OrganizationSwitcherCard extends ConsumerWidget {
  const _OrganizationSwitcherCard();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authSessionProvider);
    final memberships = ref.watch(myOrganizationsProvider);
    final switchState = ref.watch(orgSwitchControllerProvider);

    return VoltxCard(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.sm),
        child: AsyncValueView(
          value: memberships,
          onRetry: () => ref.invalidate(myOrganizationsProvider),
          loadingHeight: 80,
          data: (context, orgs) {
            if (switchState.errorMessage != null) {
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    switchState.errorMessage!,
                    style: TextStyle(color: Theme.of(context).colorScheme.error),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  _buildOrgList(context, ref, orgs, user?.organizationId, switchState.isLoading),
                ],
              );
            }
            return _buildOrgList(context, ref, orgs, user?.organizationId, switchState.isLoading);
          },
        ),
      ),
    );
  }

  Widget _buildOrgList(
    BuildContext context,
    WidgetRef ref,
    List<AuthOrganizationMembership> orgs,
    String? currentOrganizationId,
    bool isSwitching,
  ) {
    final colors = context.voltxColors;
    return Column(
      children: [
        for (final org in orgs)
          ListTile(
            contentPadding: EdgeInsets.zero,
            leading: Icon(
              org.organizationId == currentOrganizationId
                  ? Icons.radio_button_checked
                  : Icons.radio_button_unchecked,
              color: org.organizationId == currentOrganizationId ? Theme.of(context).colorScheme.primary : null,
            ),
            title: Text(org.organizationName),
            subtitle: Text(
              org.roleName,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.textSecondary),
            ),
            trailing: isSwitching ? const SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(strokeWidth: 2),
            ) : null,
            onTap: org.organizationId == currentOrganizationId || isSwitching
                ? null
                : () async {
                    final success =
                        await ref.read(orgSwitchControllerProvider.notifier).switchTo(org.organizationId);
                    if (success && context.mounted) {
                      invalidateOrganizationScopedProviders(ref);
                      context.go(AppRoutes.dashboard);
                    }
                  },
          ),
      ],
    );
  }
}
