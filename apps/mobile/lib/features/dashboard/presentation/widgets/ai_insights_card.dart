import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../theme/components/voltx_motion.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../data/models/dashboard_models.dart';
import '../providers/dashboard_providers.dart';
import 'dashboard_v2_components.dart';
import 'dashboard_v2_tokens.dart';

/// Premium AI daily briefing surface for executive dashboard.
class AiInsightsCard extends ConsumerWidget {
  const AiInsightsCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final insights = ref.watch(dashboardInsightsProvider);
    final t = DashboardV2Tokens.of(context);
    final risks = insights.where((i) => i.summary.toLowerCase().contains('wear')).toList();
    final opportunities = insights.where((i) => i.summary.toLowerCase().contains('save')).toList();

    return DashboardGlassCard(
      highlighted: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          DashboardSectionHeader(
            title: 'AI Daily Briefing',
            subtitle: 'What is happening, what needs attention, and what to do next',
            trailing: DashboardStatusBadge(
              label: '${insights.length} Signals',
              color: t.primary,
              icon: Icons.auto_awesome_rounded,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          if (insights.isEmpty)
            const DashboardEmptyState(
              title: 'No briefing available',
              subtitle: 'The next AI executive summary will appear after data sync.',
              suggestion: 'Run AI insight refresh',
              icon: Icons.auto_awesome_outlined,
            )
          else ...[
            _SectionBlock(
              title: 'Today\'s Insights',
              icon: Icons.analytics_outlined,
              items: insights,
            ),
            const SizedBox(height: AppSpacing.sm),
            _SectionBlock(
              title: 'Risks',
              icon: Icons.warning_amber_rounded,
              items: risks.isEmpty ? insights.take(1).toList() : risks,
              accent: t.warning,
            ),
            const SizedBox(height: AppSpacing.sm),
            _SectionBlock(
              title: 'Opportunities',
              icon: Icons.north_east_rounded,
              items: opportunities.isEmpty ? insights.take(1).toList() : opportunities,
              accent: t.success,
            ),
            const SizedBox(height: AppSpacing.sm),
            Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.sm,
              children: [
                for (final insight in insights)
                  VoltxPressable(
                    borderRadius: BorderRadius.circular(t.radiusLg),
                    child: FilledButton.tonalIcon(
                      onPressed: () {},
                      icon: const Icon(Icons.play_arrow_rounded, size: 16),
                      label: Text(insight.actionLabel),
                      style: FilledButton.styleFrom(
                        foregroundColor: t.primary,
                        backgroundColor: t.primary.withValues(alpha: 0.12),
                        side: BorderSide(color: t.primary.withValues(alpha: 0.28)),
                      ),
                    ),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _SectionBlock extends StatelessWidget {
  const _SectionBlock({
    required this.title,
    required this.icon,
    required this.items,
    this.accent,
  });

  final String title;
  final IconData icon;
  final List<DashboardInsight> items;
  final Color? accent;

  @override
  Widget build(BuildContext context) {
    final t = DashboardV2Tokens.of(context);
    final tone = accent ?? t.primary;

    return Container(
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: t.panelStrong.withValues(alpha: 0.58),
        borderRadius: BorderRadius.circular(t.radiusLg),
        border: Border.all(color: t.border.withValues(alpha: 0.85)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 16, color: tone),
              const SizedBox(width: AppSpacing.xxs),
              Text(
                title,
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: t.textPrimary,
                      fontWeight: FontWeight.w700,
                    ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          for (var i = 0; i < items.length; i++) ...[
            _InsightTile(insight: items[i], accent: tone),
            if (i < items.length - 1) const SizedBox(height: AppSpacing.xs),
          ],
        ],
      ),
    );
  }
}

class _InsightTile extends StatelessWidget {
  const _InsightTile({required this.insight, required this.accent});

  final DashboardInsight insight;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    final t = DashboardV2Tokens.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                insight.title,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
              ),
            ),
            DashboardStatusBadge(label: '${insight.confidence}%', color: accent),
          ],
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          insight.summary,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: t.textSecondary,
                height: 1.4,
              ),
        ),
      ],
    );
  }
}
