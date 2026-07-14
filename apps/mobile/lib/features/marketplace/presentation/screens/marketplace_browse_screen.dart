import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../router/routes.dart';
import '../../../../shared/widgets/async_value_view.dart';
import '../../../../shared/widgets/empty_state.dart';
import '../../../../shared/widgets/pagination_bar.dart';
import '../../../../shared/widgets/pull_to_refresh.dart';
import '../../../../theme/components/voltx_card.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';
import '../../data/models/marketplace_models.dart';
import '../providers/marketplace_providers.dart';
import '../shell/marketplace_nav_bar.dart';

final _pageProvider = StateProvider<int>((ref) => 1);
final _categoryProvider = StateProvider<String?>((ref) => null);
final _searchProvider = StateProvider<String>((ref) => '');

class MarketplaceBrowseScreen extends ConsumerWidget {
  const MarketplaceBrowseScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final page = ref.watch(_pageProvider);
    final category = ref.watch(_categoryProvider);
    final search = ref.watch(_searchProvider);
    final apps = ref.watch(
      publishedAppsProvider(PublishedAppsQuery(page: page, category: category, search: search)),
    );

    return Column(
      children: [
        const MarketplaceNavBar(),
        Expanded(
          child: PullToRefresh(
            onRefresh: () async => ref.invalidate(publishedAppsProvider),
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(AppSpacing.md),
              children: [
                Text(
                  'Marketplace',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: AppSpacing.xs),
                TextField(
                  decoration: const InputDecoration(
                    hintText: 'Search apps',
                    prefixIcon: Icon(Icons.search_rounded),
                  ),
                  onSubmitted: (value) {
                    ref.read(_searchProvider.notifier).state = value;
                    ref.read(_pageProvider.notifier).state = 1;
                  },
                ),
                const SizedBox(height: AppSpacing.sm),
                Wrap(
                  spacing: AppSpacing.xs,
                  runSpacing: AppSpacing.xs,
                  children: [
                    FilterChip(
                      label: const Text('All categories'),
                      selected: category == null,
                      onSelected: (_) {
                        ref.read(_categoryProvider.notifier).state = null;
                        ref.read(_pageProvider.notifier).state = 1;
                      },
                    ),
                    for (final key in marketplaceAppCategories)
                      FilterChip(
                        label: Text(_categoryLabel(key)),
                        selected: category == key,
                        onSelected: (_) {
                          ref.read(_categoryProvider.notifier).state = key;
                          ref.read(_pageProvider.notifier).state = 1;
                        },
                      ),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),
                AsyncValueView<PublicMarketplaceAppList>(
                  value: apps,
                  onRetry: () => ref.invalidate(publishedAppsProvider),
                  isEmpty: (result) => result.items.isEmpty,
                  empty: (context) => const EmptyState(
                    icon: Icons.storefront_outlined,
                    title: 'No apps found',
                    message: 'Try a different category or search term.',
                  ),
                  data: (context, result) => Column(
                    children: [
                      for (final app in result.items)
                        Padding(
                          padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                          child: _AppTile(app: app),
                        ),
                      PaginationBar(
                        page: result.page,
                        totalPages: result.totalPages,
                        onPageChanged: (p) => ref.read(_pageProvider.notifier).state = p,
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

  static String _categoryLabel(String key) {
    return key
        .split('_')
        .map((part) => part.isEmpty ? part : '${part[0]}${part.substring(1).toLowerCase()}')
        .join(' ');
  }
}

class _AppTile extends StatelessWidget {
  const _AppTile({required this.app});

  final PublicMarketplaceApp app;

  @override
  Widget build(BuildContext context) {
    final colors = context.voltxColors;
    return VoltxCard(
      onTap: () => context.go(AppRoutes.marketplaceAppDetails(app.id)),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(color: colors.surfaceMuted, borderRadius: BorderRadius.circular(12)),
            alignment: Alignment.center,
            child: Icon(Icons.widgets_outlined, color: colors.textSecondary),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(app.name, style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700)),
                if (app.description != null)
                  Text(
                    app.description!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.textSecondary),
                  ),
                Row(
                  children: [
                    Icon(Icons.star_rounded, size: 14, color: colors.warning),
                    const SizedBox(width: 2),
                    Text(
                      '${app.averageRating.toStringAsFixed(1)} (${app.reviewCount})',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(color: colors.textSecondary),
                    ),
                    const SizedBox(width: AppSpacing.xs),
                    Text(
                      app.priceCents == null || app.priceCents == 0
                          ? 'Free'
                          : '\$${(app.priceCents! / 100).toStringAsFixed(2)}',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(fontWeight: FontWeight.w700),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const Icon(Icons.chevron_right_rounded),
        ],
      ),
    );
  }
}
