import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/components/voltx_motion.dart';
import '../../data/models/dashboard_models.dart';
import '../providers/dashboard_providers.dart';
import 'dashboard_v2_components.dart';
import 'dashboard_v2_tokens.dart';

/// Premium chart surface summarizing momentum and risk trajectories.
class ExecutiveCharts extends ConsumerWidget {
  const ExecutiveCharts({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final kpis = ref.watch(dashboardKpisProvider);
    final t = DashboardV2Tokens.of(context);

    return DashboardGlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const DashboardSectionHeader(
            title: 'Revenue, Pipeline, and Forecast',
            subtitle: 'Performance trajectory for executive decisioning',
          ),
          const SizedBox(height: AppSpacing.md),
          if (kpis.isEmpty) ...[
            const DashboardSkeletonLine(width: 220),
            const SizedBox(height: AppSpacing.sm),
            const DashboardSkeletonLine(height: 120),
            const SizedBox(height: AppSpacing.sm),
            const DashboardEmptyState(
              title: 'Charts are loading',
              subtitle: 'As data arrives, trend and variance charts will render.',
              suggestion: 'Run AI chart diagnostics',
              icon: Icons.show_chart_rounded,
            ),
          ] else ...[
            LayoutBuilder(
              builder: (context, constraints) {
                final compact = constraints.maxWidth < 760;
                final left = _ChartBlock(
                  title: 'Revenue Chart',
                  tone: t.success,
                  values: _shapeForTrend(KpiTrend.up),
                  legend: const [
                    ('Revenue', '4.8M'),
                    ('Target', '4.5M'),
                  ],
                );
                final middle = _ChartBlock(
                  title: 'Pipeline Chart',
                  tone: t.primary,
                  values: const [0.22, 0.34, 0.38, 0.46, 0.6, 0.68, 0.8],
                  legend: const [
                    ('Qualified', '126'),
                    ('At Risk', '18'),
                  ],
                );
                final right = _ChartBlock(
                  title: 'Forecast',
                  tone: t.warning,
                  values: const [0.5, 0.56, 0.6, 0.63, 0.66, 0.71, 0.76],
                  legend: const [
                    ('Forecast', '5.1M'),
                    ('Confidence', '91%'),
                  ],
                );

                if (compact) {
                  return Column(
                    children: [
                      left,
                      const SizedBox(height: AppSpacing.sm),
                      middle,
                      const SizedBox(height: AppSpacing.sm),
                      right,
                    ],
                  );
                }

                return Row(
                  children: [
                    Expanded(flex: 4, child: left),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(flex: 4, child: middle),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(flex: 3, child: right),
                  ],
                );
              },
            ),
          ],
        ],
      ),
    );
  }

  static List<double> _shapeForTrend(KpiTrend trend) {
    return switch (trend) {
      KpiTrend.up => const [0.24, 0.34, 0.45, 0.57, 0.63, 0.76, 0.9],
      KpiTrend.down => const [0.92, 0.84, 0.78, 0.7, 0.58, 0.48, 0.34],
      KpiTrend.neutral => const [0.52, 0.54, 0.5, 0.52, 0.53, 0.51, 0.52],
    };
  }
}

class _ChartBlock extends StatelessWidget {
  const _ChartBlock({
    required this.title,
    required this.tone,
    required this.values,
    required this.legend,
  });

  final String title;
  final Color tone;
  final List<double> values;
  final List<(String, String)> legend;

  @override
  Widget build(BuildContext context) {
    final t = DashboardV2Tokens.of(context);

    return VoltxSlideIn(
      begin: const Offset(0, 0.02),
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.sm),
        decoration: BoxDecoration(
          color: t.panelStrong.withValues(alpha: 0.55),
          borderRadius: BorderRadius.circular(t.radiusLg),
          border: Border.all(color: t.border.withValues(alpha: 0.85)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: t.textPrimary,
                    fontWeight: FontWeight.w700,
                  ),
            ),
            const SizedBox(height: AppSpacing.xs),
            SizedBox(
              height: 88,
              child: DashboardSparkline(values: values, color: tone),
            ),
            const SizedBox(height: AppSpacing.xs),
            Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.xs,
              children: [
                for (final item in legend)
                  DashboardLegendItem(
                    label: item.$1,
                    value: item.$2,
                    color: tone,
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
