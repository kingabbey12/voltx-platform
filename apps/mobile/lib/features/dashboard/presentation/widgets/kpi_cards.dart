import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../shared/widgets/responsive_layout.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/components/voltx_motion.dart';
import '../../data/models/dashboard_models.dart';
import '../providers/dashboard_providers.dart';
import 'dashboard_v2_components.dart';
import 'dashboard_v2_tokens.dart';

/// Grid of KPI metric cards.
class KpiCards extends ConsumerWidget {
  const KpiCards({super.key});

  List<_ExecutiveMetric> _buildExecutiveMetrics(List<DashboardKpi> source) {
    DashboardKpi pick(int index, DashboardKpi fallback) {
      if (source.isEmpty) {
        return fallback;
      }
      if (index < source.length) {
        return source[index];
      }
      return source.last;
    }

    const fallback = DashboardKpi(
      id: 'fallback',
      label: 'Signal',
      value: '--',
      delta: '--',
      trend: KpiTrend.neutral,
      iconName: 'dashboard',
    );

    final k1 = pick(0, fallback);
    final k2 = pick(1, fallback);
    final k3 = pick(2, fallback);
    final k4 = pick(3, fallback);

    return [
      _ExecutiveMetric(
        id: 'revenue',
        label: 'Revenue',
        value: k1.value,
        delta: '+6.2% WoW',
        trend: KpiTrend.up,
        icon: Icons.payments_rounded,
        sparkline: _trendShape(KpiTrend.up),
        commentary: 'AI: Enterprise segment conversion remains ahead of plan.',
      ),
      _ExecutiveMetric(
        id: 'growth',
        label: 'Growth',
        value: k2.value,
        delta: '+1.1 pts',
        trend: KpiTrend.up,
        icon: Icons.trending_up_rounded,
        sparkline: _trendShape(KpiTrend.up),
        commentary: 'AI: Expansion velocity is strongest in the north cluster.',
      ),
      _ExecutiveMetric(
        id: 'deals',
        label: 'Active Deals',
        value: k3.value,
        delta: '+8 today',
        trend: KpiTrend.up,
        icon: Icons.handshake_outlined,
        sparkline: _trendShape(KpiTrend.up),
        commentary: 'AI: 3 high-probability deals need exec sponsorship.',
      ),
      _ExecutiveMetric(
        id: 'tasks',
        label: 'AI Tasks',
        value: '27',
        delta: '6 critical',
        trend: KpiTrend.neutral,
        icon: Icons.auto_awesome_rounded,
        sparkline: _trendShape(KpiTrend.neutral),
        commentary: 'AI: Prioritize risk remediation prompts before midday.',
      ),
      _ExecutiveMetric(
        id: 'health',
        label: 'Customer Health',
        value: '82%',
        delta: '-2 at-risk accounts',
        trend: KpiTrend.down,
        icon: Icons.favorite_border_rounded,
        sparkline: _trendShape(KpiTrend.down),
        commentary: 'AI: 2 enterprise accounts need immediate outreach.',
      ),
      _ExecutiveMetric(
        id: 'team',
        label: 'Team Activity',
        value: k4.value,
        delta: '+14% execution',
        trend: KpiTrend.up,
        icon: Icons.groups_rounded,
        sparkline: _trendShape(KpiTrend.up),
        commentary: 'AI: Stand-up completion and follow-through are improving.',
      ),
    ];
  }

  static List<double> _trendShape(KpiTrend trend) {
    return switch (trend) {
      KpiTrend.up => const [0.26, 0.38, 0.48, 0.6, 0.7, 0.8, 0.9],
      KpiTrend.down => const [0.9, 0.82, 0.72, 0.62, 0.52, 0.44, 0.34],
      KpiTrend.neutral => const [0.52, 0.54, 0.51, 0.53, 0.52, 0.54, 0.53],
    };
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final metrics = _buildExecutiveMetrics(ref.watch(dashboardKpisProvider));
    final columns = switch (currentBreakpoint(context)) {
      AppBreakpoint.compact => 2,
      AppBreakpoint.medium => 3,
      AppBreakpoint.expanded => 4,
    };

    return DashboardGlassCard(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          DashboardSectionHeader(
            title: 'Executive Metrics',
            subtitle: 'Live performance snapshot and AI commentary',
            trailing: DashboardStatusBadge(
              label: '${metrics.length} Live KPIs',
              color: DashboardV2Tokens.of(context).primary,
              icon: Icons.radar_rounded,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          if (metrics.isEmpty)
            const DashboardEmptyState(
              title: 'Metrics are initializing',
              subtitle: 'Your KPI stream will appear shortly.',
              suggestion: 'Ask AI to refresh executive metrics',
              icon: Icons.query_stats_rounded,
            ),
          LayoutBuilder(
            builder: (context, constraints) {
              const minCardWidth = 240.0;
              final suggested = ((constraints.maxWidth + AppSpacing.sm) /
                      (minCardWidth + AppSpacing.sm))
                  .floor();
              final effectiveColumns = math.max(1, math.min(columns, suggested));
              final itemWidth = (constraints.maxWidth -
                      ((effectiveColumns - 1) * AppSpacing.sm)) /
                  effectiveColumns;

              return Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                children: [
                  for (final metric in metrics)
                    SizedBox(
                      width: itemWidth,
                      child: VoltxSlideIn(
                        begin: const Offset(0, 0.03),
                        child: _KpiCard(metric: metric),
                      ),
                    ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}

class _KpiCard extends StatelessWidget {
  const _KpiCard({required this.metric});

  final _ExecutiveMetric metric;

  @override
  Widget build(BuildContext context) {
    final t = DashboardV2Tokens.of(context);
    final trendColor = switch (metric.trend) {
      KpiTrend.up => t.success,
      KpiTrend.down => t.error,
      KpiTrend.neutral => t.textSecondary,
    };
    final iconColor = switch (metric.trend) {
      KpiTrend.up => t.primary,
      KpiTrend.down => t.warning,
      KpiTrend.neutral => t.textSecondary,
    };

    return DashboardGlassCard(
      padding: const EdgeInsets.all(AppSpacing.sm),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final compact = constraints.maxWidth < 170;

          return Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(metric.icon, size: 18, color: iconColor),
                  const Spacer(),
                  DashboardStatusBadge(
                    label: metric.delta,
                    color: trendColor,
                    icon: switch (metric.trend) {
                      KpiTrend.up => Icons.north_east_rounded,
                      KpiTrend.down => Icons.south_east_rounded,
                      KpiTrend.neutral => Icons.east_rounded,
                    },
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.xs),
              FittedBox(
                fit: BoxFit.scaleDown,
                alignment: Alignment.centerLeft,
                child: Text(
                  metric.value,
                  style: (compact
                          ? Theme.of(context).textTheme.titleLarge
                          : Theme.of(context).textTheme.headlineSmall)
                      ?.copyWith(
                        fontWeight: FontWeight.w800,
                        color: t.textPrimary,
                        letterSpacing: -0.6,
                      ),
                ),
              ),
              const SizedBox(height: 2),
              Text(
                metric.label,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: t.textSecondary,
                    ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: AppSpacing.xs),
              DashboardSparkline(
                values: metric.sparkline,
                color: trendColor,
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                metric.commentary,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: t.textTertiary,
                      fontWeight: FontWeight.w500,
                    ),
                maxLines: compact ? 2 : 3,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          );
        },
      ),
    );
  }
}

class _ExecutiveMetric {
  const _ExecutiveMetric({
    required this.id,
    required this.label,
    required this.value,
    required this.delta,
    required this.trend,
    required this.icon,
    required this.sparkline,
    required this.commentary,
  });

  final String id;
  final String label;
  final String value;
  final String delta;
  final KpiTrend trend;
  final IconData icon;
  final List<double> sparkline;
  final String commentary;
}
