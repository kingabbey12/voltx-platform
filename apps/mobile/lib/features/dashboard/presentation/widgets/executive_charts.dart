import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/components/voltx_motion.dart';
import '../providers/dashboard_providers.dart';
import 'dashboard_v2_components.dart';
import 'dashboard_v2_tokens.dart';

/// Premium chart surface summarizing momentum and risk trajectories.
class ExecutiveCharts extends ConsumerWidget {
  const ExecutiveCharts({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final kpis = ref.watch(dashboardKpisProvider);
    final revenueSeries = ref.watch(dashboardRevenueSeriesProvider);
    final pipelineSeries = ref.watch(dashboardPipelineSeriesProvider);
    final forecastSeries = ref.watch(dashboardForecastSeriesProvider);
    final t = DashboardV2Tokens.of(context);

    String kpiValue(String label, String fallback) {
      for (final kpi in kpis) {
        if (kpi.label.toLowerCase() == label.toLowerCase()) {
          return kpi.value;
        }
      }
      return fallback;
    }

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
                  values: revenueSeries,
                  legend: [
                    ('Revenue', kpiValue('Revenue', '--')),
                    ('Pipeline', kpiValue('Pipeline', '--')),
                  ],
                );
                final middle = _ChartBlock(
                  title: 'Pipeline Chart',
                  tone: t.primary,
                  values: pipelineSeries,
                  legend: [
                    ('Leads', kpiValue('Leads', '--')),
                    ('Contacts', kpiValue('Contacts', '--')),
                  ],
                );
                final right = _ChartBlock(
                  title: 'Forecast',
                  tone: t.warning,
                  values: forecastSeries,
                  legend: [
                    ('Activities', kpiValue('Activities', '--')),
                    ('AI Context', kpiValue('AI Context', '--')),
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
