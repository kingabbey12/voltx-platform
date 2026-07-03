import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../theme/components/voltx_card.dart';
import '../../../../theme/components/voltx_text_field.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';
import '../providers/dashboard_providers.dart';

/// Global search with live mock results.
class GlobalSearch extends ConsumerWidget {
  const GlobalSearch({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final query = ref.watch(dashboardSearchProvider);
    final results = ref.watch(dashboardSearchResultsProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        VoltxTextField(
          hint: 'Search projects, people, alerts…',
          prefixIcon: Icons.search_rounded,
          onChanged: ref.read(dashboardSearchProvider.notifier).setQuery,
          textInputAction: TextInputAction.search,
        ),
        const SizedBox(height: AppSpacing.md),
        if (query.isEmpty)
          Text(
            'Suggested',
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
                  color: context.voltxColors.textSecondary,
                ),
          ),
        if (query.isEmpty) const SizedBox(height: AppSpacing.sm),
        for (var i = 0; i < results.length; i++) ...[
          _SearchResultTile(
            title: results[i].title,
            subtitle: results[i].subtitle,
            category: results[i].category,
            onTap: () {
              ref.read(dashboardSearchProvider.notifier).clear();
              context.go(results[i].route);
            },
          ),
          if (i < results.length - 1) const SizedBox(height: AppSpacing.xs),
        ],
        if (results.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: AppSpacing.xl),
            child: Text(
              'No results for "$query"',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: context.voltxColors.textSecondary,
                  ),
            ),
          ),
      ],
    );
  }
}

class _SearchResultTile extends StatelessWidget {
  const _SearchResultTile({
    required this.title,
    required this.subtitle,
    required this.category,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final String category;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.voltxColors;

    return VoltxCard(
      onTap: onTap,
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.sm,
      ),
      child: Row(
        children: [
          Icon(Icons.search_rounded, size: 20, color: colors.textTertiary),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                ),
                Text(
                  subtitle,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: colors.textSecondary,
                      ),
                ),
              ],
            ),
          ),
          Text(
            category,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: colors.textTertiary,
                ),
          ),
        ],
      ),
    );
  }
}
