import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../shared/widgets/empty_state.dart';
import '../../../../theme/components/voltx_button.dart';
import '../../../../theme/components/voltx_card.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';
import '../../data/models/dashboard_models.dart';
import '../providers/dashboard_providers.dart';

/// Full notification center list with mark-read actions.
class NotificationCenter extends ConsumerWidget {
  const NotificationCenter({super.key});

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
  Widget build(BuildContext context, WidgetRef ref) {
    final notifications = ref.watch(dashboardNotificationsProvider);
    final unread = notifications.where((n) => !n.read).length;

    if (notifications.isEmpty) {
      return const EmptyState(
        icon: Icons.notifications_none_rounded,
        title: 'No notifications',
        message: "You're all caught up. New activity will appear here.",
      );
    }

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (unread > 0)
          Align(
            alignment: Alignment.centerRight,
            child: VoltxButton(
              label: 'Mark all read',
              variant: VoltxButtonVariant.ghost,
              size: VoltxButtonSize.medium,
              onPressed: () =>
                  ref.read(dashboardNotificationsProvider.notifier).markAllRead(),
            ),
          ),
        const SizedBox(height: AppSpacing.sm),
        for (var i = 0; i < notifications.length; i++) ...[
          _NotificationTile(
            notification: notifications[i],
            timeAgo: _timeAgo(notifications[i].timestamp),
            onTap: () => ref
                .read(dashboardNotificationsProvider.notifier)
                .markRead(notifications[i].id),
          ),
          if (i < notifications.length - 1) const SizedBox(height: AppSpacing.sm),
        ],
      ],
    );
  }
}

class _NotificationTile extends StatelessWidget {
  const _NotificationTile({
    required this.notification,
    required this.timeAgo,
    required this.onTap,
  });

  final DashboardNotification notification;
  final String timeAgo;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.voltxColors;
    final scheme = Theme.of(context).colorScheme;

    return VoltxCard(
      variant: notification.read ? VoltxCardVariant.outlined : VoltxCardVariant.elevated,
      onTap: onTap,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (!notification.read)
            Container(
              width: 8,
              height: 8,
              margin: const EdgeInsets.only(top: 6, right: AppSpacing.sm),
              decoration: BoxDecoration(
                color: scheme.primary,
                shape: BoxShape.circle,
              ),
            )
          else
            const SizedBox(width: 8 + AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        notification.title,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              fontWeight: FontWeight.w600,
                            ),
                      ),
                    ),
                    Text(
                      timeAgo,
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: colors.textTertiary,
                          ),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  notification.body,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: colors.textSecondary,
                      ),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  notification.category,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: scheme.primary,
                        fontWeight: FontWeight.w600,
                      ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
