import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../shared/widgets/async_value_view.dart';
import '../../../../shared/widgets/empty_state.dart';
import '../../../../shared/widgets/pagination_bar.dart';
import '../../../../shared/widgets/pull_to_refresh.dart';
import '../../../../theme/components/voltx_card.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';
import '../../data/models/security_models.dart';
import '../providers/security_providers.dart';
import '../shell/security_nav_bar.dart';

class SecurityLoginHistoryScreen extends ConsumerWidget {
  const SecurityLoginHistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final page = ref.watch(loginHistoryPageProvider);
    final history = ref.watch(loginHistoryProvider(page));

    return Column(
      children: [
        const SecurityNavBar(),
        Expanded(
          child: PullToRefresh(
            onRefresh: () async => ref.invalidate(loginHistoryProvider),
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(AppSpacing.md),
              children: [
                Text(
                  'Login history',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  'Every successful sign-in to your account within this organization.',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: AppSpacing.md),
                AsyncValueView<PaginatedSessions>(
                  value: history,
                  onRetry: () => ref.invalidate(loginHistoryProvider),
                  isEmpty: (result) => result.items.isEmpty,
                  empty: (context) => const EmptyState(
                    icon: Icons.history_outlined,
                    title: 'No login history',
                    message: 'Nothing to show here yet.',
                  ),
                  data: (context, result) => Column(
                    children: [
                      for (final entry in result.items)
                        Padding(
                          padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                          child: _HistoryTile(entry: entry),
                        ),
                      PaginationBar(
                        page: result.page,
                        totalPages: result.totalPages,
                        onPageChanged: (p) => ref.read(loginHistoryPageProvider.notifier).state = p,
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

class _HistoryTile extends StatelessWidget {
  const _HistoryTile({required this.entry});

  final Session entry;

  @override
  Widget build(BuildContext context) {
    final colors = context.voltxColors;
    return VoltxCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            entry.userAgent ?? 'Unknown device',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
          ),
          Text(
            entry.ipAddress ?? 'Unknown IP',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.textSecondary),
          ),
          const SizedBox(height: AppSpacing.xxs),
          Text(
            'Signed in ${entry.createdAt.split('T').first} · Last active ${entry.lastActiveAt.split('T').first}',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.textSecondary),
          ),
        ],
      ),
    );
  }
}
