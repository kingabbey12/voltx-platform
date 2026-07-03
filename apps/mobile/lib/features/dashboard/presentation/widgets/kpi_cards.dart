import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../shared/widgets/responsive_layout.dart';
import '../../../../theme/components/voltx_card.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';
import '../../data/models/dashboard_models.dart';
import '../providers/dashboard_providers.dart';

/// Grid of KPI metric cards.
class KpiCards extends ConsumerWidget {
  const KpiCards({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final kpis = ref.watch(dashboardKpisProvider);
    final columns = switch (currentBreakpoint(context)) {
      AppBreakpoint.compact => 2,
      AppBreakpoint.medium => 2,
      AppBreakpoint.expanded => 4,
    };

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: columns,
        crossAxisSpacing: AppSpacing.sm,
        mainAxisSpacing: AppSpacing.sm,
        childAspectRatio: columns == 4 ? 1.6 : 1.1,
      ),
      itemCount: kpis.length,
      itemBuilder: (context, index) => _KpiCard(kpi: kpis[index]),
    );
  }
}

class _KpiCard extends StatelessWidget {
  const _KpiCard({required this.kpi});

  final DashboardKpi kpi;

  @override
  Widget build(BuildContext context) {
    final colors = context.voltxColors;
    final scheme = Theme.of(context).colorScheme;
    final trendColor = switch (kpi.trend) {
      KpiTrend.up => colors.success,
      KpiTrend.down => colors.error,
      KpiTrend.neutral => colors.textSecondary,
    };

    return VoltxCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Icon(dashboardIcon(kpi.iconName), size: 20, color: scheme.primary),
              const Spacer(),
              Icon(
                switch (kpi.trend) {
                  KpiTrend.up => Icons.trending_up_rounded,
                  KpiTrend.down => Icons.trending_down_rounded,
                  KpiTrend.neutral => Icons.trending_flat_rounded,
                },
                size: 18,
                color: trendColor,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            kpi.value,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
          ),
          const SizedBox(height: AppSpacing.xxs),
          Text(
            kpi.label,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: colors.textSecondary,
                ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          Text(
            kpi.delta,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: trendColor,
                  fontWeight: FontWeight.w600,
                ),
          ),
        ],
      ),
    );
  }
}
