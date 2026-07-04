import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../theme/tokens/spacing.dart';
import '../../data/models/dashboard_models.dart';
import '../providers/dashboard_providers.dart';
import 'dashboard_v2_components.dart';
import 'dashboard_v2_tokens.dart';

/// Recent activity timeline feed.
class ActivityFeed extends ConsumerWidget {
  const ActivityFeed({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final activities = ref.watch(dashboardActivitiesProvider);
    final grouped = _grouped(activities);

    return DashboardGlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const DashboardSectionHeader(
            title: 'Recent Activity',
            subtitle: 'Operational events and decisions',
          ),
          const SizedBox(height: AppSpacing.sm),
          if (activities.isEmpty)
            const DashboardEmptyState(
              title: 'No activity yet',
              subtitle: 'When events arrive, they will appear here in timeline order.',
              suggestion: 'Ask AI to summarize today\'s operations',
              icon: Icons.history_toggle_off_rounded,
            ),
          for (final entry in grouped.entries) ...[
            DashboardStatusBadge(
              label: entry.key,
              color: DashboardV2Tokens.of(context).primary,
              icon: Icons.schedule_rounded,
            ),
            const SizedBox(height: AppSpacing.xs),
            for (var i = 0; i < entry.value.length; i++) ...[
              _ActivityTile(
                activity: entry.value[i],
                isLastInGroup: i == entry.value.length - 1,
              ),
              if (i < entry.value.length - 1) const SizedBox(height: AppSpacing.xs),
            ],
            const SizedBox(height: AppSpacing.sm),
          ],
        ],
      ),
    );
  }

  Map<String, List<DashboardActivity>> _grouped(List<DashboardActivity> activities) {
    final now = DateTime.now();
    final map = <String, List<DashboardActivity>>{};
    for (final activity in activities) {
      final diff = now.difference(activity.timestamp);
      final key = diff.inHours < 1
          ? 'Now'
          : diff.inHours < 4
              ? 'Earlier today'
              : 'Today';
      map.putIfAbsent(key, () => []).add(activity);
    }
    return map;
  }
}

class _ActivityTile extends StatelessWidget {
  const _ActivityTile({required this.activity, required this.isLastInGroup});

  final DashboardActivity activity;
  final bool isLastInGroup;

  IconData _icon(ActivityType type) {
    return switch (type) {
      ActivityType.alert => Icons.warning_amber_rounded,
      ActivityType.update => Icons.update_rounded,
      ActivityType.approval => Icons.check_circle_outline_rounded,
      ActivityType.insight => Icons.auto_awesome_rounded,
    };
  }

  Color _iconColor(BuildContext context, ActivityType type) {
    final t = DashboardV2Tokens.of(context);
    return switch (type) {
      ActivityType.alert => t.warning,
      ActivityType.update => t.primary,
      ActivityType.approval => t.success,
      ActivityType.insight => t.primary,
    };
  }

  String _timeAgo(DateTime timestamp) {
    final diff = DateTime.now().difference(timestamp);
    if (diff.inMinutes < 60) {
      return '${diff.inMinutes}m ago';
    }
    if (diff.inHours < 24) {
      return '${diff.inHours}h ago';
    }
    return '${diff.inDays}d ago';
  }

  @override
  Widget build(BuildContext context) {
    final t = DashboardV2Tokens.of(context);
    final iconTone = _iconColor(context, activity.type);

    return Container(
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: t.panelStrong.withValues(alpha: 0.55),
        borderRadius: BorderRadius.circular(t.radiusLg),
        border: Border.all(color: t.border.withValues(alpha: 0.8)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          DashboardTimelineDot(
            color: iconTone,
            showConnector: !isLastInGroup,
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      width: 30,
                      height: 30,
                      decoration: BoxDecoration(
                        color: iconTone.withValues(alpha: 0.14),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(_icon(activity.type), size: 16, color: iconTone),
                    ),
                    const SizedBox(width: AppSpacing.xs),
                    Expanded(
                      child: Text(
                        activity.title,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              fontWeight: FontWeight.w700,
                              color: t.textPrimary,
                            ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  activity.subtitle,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(color: t.textSecondary),
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          Text(
            _timeAgo(activity.timestamp),
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: t.textTertiary,
                  fontWeight: FontWeight.w600,
                ),
          ),
        ],
      ),
    );
  }
}
