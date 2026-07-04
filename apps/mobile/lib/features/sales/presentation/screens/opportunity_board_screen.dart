import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../shared/widgets/responsive_layout.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../data/models/sales_models.dart';
import '../providers/sales_providers.dart';
import '../widgets/sales_widgets.dart';

class OpportunityBoardScreen extends ConsumerWidget {
  const OpportunityBoardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(authSessionProvider);
    if (!_hasSalesReadAccess(session)) {
      return const _SalesAccessRequired();
    }

    final stage = ref.watch(opportunityStageFilterProvider);
    final opportunities = ref.watch(
      opportunitiesProvider(
        SalesPageQuery(
          limit: 100,
          filters: {
            'stage': ?stage,
          },
        ),
      ),
    );
    final copilotState = ref.watch(salesCopilotControllerProvider);
    final isMobile = currentBreakpoint(context) == AppBreakpoint.compact;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: ResponsiveLayout(
        maxContentWidth: 1500,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Pipeline Intelligence Board',
              style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              'Monitor stage flow, identify deal risk, and launch AI guidance without opening individual records.',
              style: Theme.of(context).textTheme.bodyLarge,
            ),
            const SizedBox(height: AppSpacing.md),
            Wrap(
              spacing: AppSpacing.xs,
              runSpacing: AppSpacing.xs,
              children: [
                FilterChip(
                  label: const Text('All'),
                  selected: stage == null,
                  onSelected: (_) => ref.read(opportunityStageFilterProvider.notifier).state = null,
                ),
                for (final value in salesOpportunityStages)
                  FilterChip(
                    label: Text(value.replaceAll('_', ' ')),
                    selected: stage == value,
                    onSelected: (_) =>
                        ref.read(opportunityStageFilterProvider.notifier).state = value,
                  ),
              ],
            ),
            const SizedBox(height: AppSpacing.lg),
              SalesSectionCard(
                title: 'Forecast Widgets',
                subtitle: 'Real-time board health by probability and value',
                child: _ForecastWidgets(opportunities: opportunities),
              ),
              const SizedBox(height: AppSpacing.md),
            SalesAiResultCard(
              state: copilotState,
              onClear: () => ref.read(salesCopilotControllerProvider.notifier).clear(),
            ),
            const SizedBox(height: AppSpacing.lg),
            opportunities.when(
              data: (page) {
                final grouped = {
                  for (final value in salesOpportunityStages)
                    value: page.items.where((item) => item.stage == value).toList(),
                };

                if (isMobile) {
                  return Column(
                    children: grouped.entries.map((entry) {
                      return Padding(
                        padding: const EdgeInsets.only(bottom: AppSpacing.md),
                        child: SalesSectionCard(
                          title: entry.key.replaceAll('_', ' '),
                          subtitle: '${entry.value.length} opportunities · ${_stageAmount(entry.value)}',
                          child: entry.value.isEmpty
                              ? const SalesEmptyState(
                                  title: 'No deals in this stage',
                                  subtitle: 'As deals advance, this lane will populate automatically.',
                                  icon: Icons.filter_none_rounded,
                                )
                              : Column(
                                  children: entry.value
                                      .map((item) => _OpportunityCard(item: item))
                                      .toList(),
                                ),
                        ),
                      );
                    }).toList(),
                  );
                }

                return SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: grouped.entries.map((entry) {
                      return Padding(
                        padding: const EdgeInsets.only(right: AppSpacing.md),
                        child: SizedBox(
                          width: 280,
                          child: SalesSectionCard(
                            title: entry.key.replaceAll('_', ' '),
                            subtitle: '${entry.value.length} opportunities · ${_stageAmount(entry.value)}',
                            child: entry.value.isEmpty
                                ? const SalesEmptyState(
                                    title: 'No deals in this stage',
                                    subtitle: 'Pipeline movement will appear here.',
                                    icon: Icons.inbox_outlined,
                                  )
                                : Column(
                                    children:
                                        entry.value.map((item) => _OpportunityCard(item: item)).toList(),
                                  ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                );
              },
              loading: () => const SalesSectionCard(
                title: 'Loading board',
                subtitle: 'Building stage intelligence',
                child: Column(
                  children: [
                    SalesSkeletonLine(),
                    SizedBox(height: AppSpacing.sm),
                    SalesSkeletonLine(),
                  ],
                ),
              ),
              error: (error, _) => SalesSectionCard(
                title: 'Unable to load opportunities',
                child: Text(error.toString()),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SalesAccessRequired extends StatelessWidget {
  const _SalesAccessRequired();

  @override
  Widget build(BuildContext context) {
    return const SingleChildScrollView(
      padding: EdgeInsets.all(AppSpacing.md),
      child: ResponsiveLayout(
        maxContentWidth: 980,
        child: SalesSectionCard(
          title: 'Sales Access Required',
          subtitle: 'Opportunity board is unavailable for this account.',
          child: SalesEmptyState(
            title: 'No permission to load opportunities',
            subtitle: 'Grant sales.opportunity.read to enable pipeline board access.',
            icon: Icons.lock_outline_rounded,
          ),
        ),
      ),
    );
  }
}

bool _hasSalesReadAccess(dynamic session) {
  if (session == null) {
    return true;
  }

  final permissions = session?.permissions;
  if (permissions is! List<String>) {
    return false;
  }

  return permissions.any((permission) => permission.startsWith('sales.'));
}

class _OpportunityCard extends ConsumerWidget {
  const _OpportunityCard({required this.item});

  final SalesOpportunity item;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: SalesSectionCard(
        title: item.title,
        subtitle: '${_amountLabel(item)} · ${item.stage.replaceAll('_', ' ')}',
        trailing: SalesStatusChip(item.stage),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            SalesProbabilityBar(value: item.probability),
            if (item.nextBestAction != null) ...[
              const SizedBox(height: AppSpacing.sm),
              SalesRecommendationCard(
                title: 'Next Best Action',
                body: item.nextBestAction!,
                icon: Icons.psychology_alt_rounded,
              ),
            ],
            const SizedBox(height: AppSpacing.sm),
            Wrap(
              spacing: AppSpacing.xs,
              runSpacing: AppSpacing.xs,
              children: [
                FilledButton.tonal(
                  onPressed: () async {
                    await ref
                        .read(salesCopilotControllerProvider.notifier)
                        .opportunityInsights(item.id);
                  },
                  child: const Text('Insights'),
                ),
                OutlinedButton(
                  onPressed: () async {
                    await ref
                        .read(salesCopilotControllerProvider.notifier)
                        .nextBestAction(item.id);
                  },
                  child: const Text('Next action'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _ForecastWidgets extends StatelessWidget {
  const _ForecastWidgets({required this.opportunities});

  final AsyncValue<PaginatedSalesResult<SalesOpportunity>> opportunities;

  @override
  Widget build(BuildContext context) {
    return opportunities.when(
      data: (page) {
        if (page.items.isEmpty) {
          return const SalesEmptyState(
            title: 'No opportunities yet',
            subtitle: 'Forecast tiles appear when opportunities are available.',
            icon: Icons.query_stats_rounded,
          );
        }

        final total = page.items.fold<double>(0, (sum, item) => sum + (item.amount ?? 0));
        final weighted = page.items.fold<double>(
          0,
          (sum, item) => sum + ((item.amount ?? 0) * (item.probability / 100)),
        );
        final risky = page.items.where((item) => item.probability < 40).length;
        final best = [...page.items]..sort((a, b) => b.probability.compareTo(a.probability));

        return Wrap(
          spacing: AppSpacing.md,
          runSpacing: AppSpacing.md,
          children: [
            SalesMetricCard(
              label: 'Total Pipeline',
              value: '\$${(total / 1000).toStringAsFixed(0)}k',
              icon: Icons.attach_money_rounded,
              footnote: 'Open + late stage',
            ),
            SalesMetricCard(
              label: 'Weighted Forecast',
              value: '\$${(weighted / 1000).toStringAsFixed(0)}k',
              icon: Icons.query_stats_rounded,
              footnote: 'Probability adjusted',
            ),
            SalesMetricCard(
              label: 'Risk Radar',
              value: '$risky deals',
              icon: Icons.warning_amber_rounded,
              footnote: 'Under 40% probability',
            ),
            SalesRecommendationCard(
              title: 'Top Confidence Deal',
              body: '${best.first.title} · ${best.first.probability}% confidence',
              icon: Icons.trending_up_rounded,
              action: SalesProbabilityBar(value: best.first.probability),
            ),
          ],
        );
      },
      loading: () => const Column(
        children: [
          SalesSkeletonLine(),
          SizedBox(height: AppSpacing.sm),
          SalesSkeletonLine(),
        ],
      ),
      error: (error, _) => Text(error.toString()),
    );
  }
}

String _amountLabel(SalesOpportunity item) {
  if (item.amount == null) {
    return '-- ${item.currency}';
  }
  return '\$${item.amount!.toStringAsFixed(0)} ${item.currency}';
}

String _stageAmount(List<SalesOpportunity> items) {
  final total = items.fold<double>(0, (sum, item) => sum + (item.amount ?? 0));
  if (total == 0) {
    return '\$--';
  }
  return '\$${(total / 1000).toStringAsFixed(0)}k';
}
