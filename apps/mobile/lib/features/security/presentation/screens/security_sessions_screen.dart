import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../shared/widgets/async_value_view.dart';
import '../../../../shared/widgets/empty_state.dart';
import '../../../../shared/widgets/pull_to_refresh.dart';
import '../../../../theme/components/voltx_card.dart';
import '../../../../theme/components/voltx_snackbar.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';
import '../../data/models/security_models.dart';
import '../providers/security_providers.dart';
import '../shell/security_nav_bar.dart';

class SecuritySessionsScreen extends ConsumerWidget {
  const SecuritySessionsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final sessions = ref.watch(sessionsProvider);
    final actionState = ref.watch(securityActionControllerProvider);

    return Column(
      children: [
        const SecurityNavBar(),
        Expanded(
          child: PullToRefresh(
            onRefresh: () async => ref.invalidate(sessionsProvider),
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(AppSpacing.md),
              children: [
                Text(
                  'Active sessions',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  'Every device currently signed in to your account within this organization.',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: AppSpacing.md),
                AsyncValueView<List<Session>>(
                  value: sessions,
                  onRetry: () => ref.invalidate(sessionsProvider),
                  isEmpty: (result) => result.isEmpty,
                  empty: (context) => const EmptyState(
                    icon: Icons.devices_other_outlined,
                    title: 'No active sessions',
                    message: 'Nothing to show here.',
                  ),
                  data: (context, result) => Column(
                    children: [
                      for (final session in result)
                        Padding(
                          padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                          child: _SessionTile(session: session, isLoading: actionState.isLoading),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _SessionTile extends ConsumerWidget {
  const _SessionTile({required this.session, required this.isLoading});

  final Session session;
  final bool isLoading;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.voltxColors;
    return VoltxCard(
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  session.userAgent ?? 'Unknown device',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
                ),
                Text(
                  session.ipAddress ?? 'Unknown IP',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.textSecondary),
                ),
              ],
            ),
          ),
          OutlinedButton(
            onPressed: isLoading ? null : () => _revoke(context, ref),
            child: const Text('Revoke'),
          ),
        ],
      ),
    );
  }

  Future<void> _revoke(BuildContext context, WidgetRef ref) async {
    final success = await ref.read(securityActionControllerProvider.notifier).revokeSession(session.id);
    if (!context.mounted) return;
    if (success) {
      showVoltxSnackbar(context, message: 'Session revoked', variant: VoltxSnackbarVariant.success);
    } else {
      showVoltxSnackbar(
        context,
        message: ref.read(securityActionControllerProvider).errorMessage ?? 'Unable to revoke session',
        variant: VoltxSnackbarVariant.error,
      );
    }
  }
}
