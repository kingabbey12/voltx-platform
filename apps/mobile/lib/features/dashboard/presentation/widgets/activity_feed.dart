import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../theme/components/voltx_card.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';
import '../../data/models/dashboard_models.dart';
import '../providers/dashboard_providers.dart';

/// Recent activity timeline feed.
class ActivityFeed extends ConsumerWidget {
  const ActivityFeed({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final activities = ref.watch(dashboardActivitiesProvider);

    return VoltxCard(
      padding: const EdgeInsets.all(AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Recent Activity', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: AppSpacing.sm),
          for (var i = 0; i < activities.length; i++) ...[
            _ActivityTile(activity: activities[i]),
            if (i < activities.length - 1)
              Divider(height: AppSpacing.lg, color: context.voltxColors.borderSubtle),
          ],
        ],
      ),
    );
  }
}

class _ActivityTile extends StatelessWidget {
  const _ActivityTile({required this.activity});

  final DashboardActivity activity;

  IconData _icon(ActivityType type) {
    return switch (type) {
      ActivityType.alert => Icons.warning_amber_rounded,
      ActivityType.update => Icons.update_rounded,
      ActivityType.approval => Icons.check_circle_outline_rounded,
      ActivityType.insight => Icons.auto_awesome_rounded,
    };
  }

  Color _iconColor(BuildContext context, ActivityType type) {
    final colors = context.voltxColors;
    return switch (type) {
      ActivityType.alert => colors.warning,
      ActivityType.update => colors.info,
      ActivityType.approval => colors.success,
      ActivityType.insight => Theme.of(context).colorScheme.primary,
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
    final colors = context.voltxColors;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: _iconColor(context, activity.type).withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(_icon(activity.type), size: 18, color: _iconColor(context, activity.type)),
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(activity.title, style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
              const SizedBox(height: 2),
              Text(
                activity.subtitle,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.textSecondary),
              ),
            ],
          ),
        ),
        Text(
          _timeAgo(activity.timestamp),
          style: Theme.of(context).textTheme.labelSmall?.copyWith(color: colors.textTertiary),
        ),
      ],
    );
  }
}
