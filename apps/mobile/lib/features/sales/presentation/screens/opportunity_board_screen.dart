import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../shared/widgets/responsive_layout.dart';
import '../../../../theme/components/voltx_card.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../data/models/sales_models.dart';
import '../providers/sales_providers.dart';
import '../widgets/sales_widgets.dart';

class OpportunityBoardScreen extends ConsumerWidget {
  const OpportunityBoardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
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
        maxContentWidth: 1400,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Opportunity Board',
              style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
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
                          subtitle: '${entry.value.length} opportunities',
                          child: Column(
                            children: entry.value.map((item) => _OpportunityCard(item: item)).toList(),
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
                            subtitle: '${entry.value.length} opportunities',
                            child: Column(
                              children: entry.value.map((item) => _OpportunityCard(item: item)).toList(),
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                );
              },
              loading: () => const Center(child: CircularProgressIndicator()),
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

class _OpportunityCard extends ConsumerWidget {
  const _OpportunityCard({required this.item});

  final SalesOpportunity item;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: VoltxCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              item.title,
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              '${item.amount?.toStringAsFixed(0) ?? '--'} ${item.currency} · ${item.probability}%',
            ),
            if (item.nextBestAction != null) ...[
              const SizedBox(height: AppSpacing.xs),
              Text(
                item.nextBestAction!,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
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
