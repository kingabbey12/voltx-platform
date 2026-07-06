import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../shared/widgets/pull_to_refresh.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../data/models/dashboard_models.dart';
import '../providers/dashboard_providers.dart';
import '../widgets/activity_feed.dart';
import '../widgets/ai_insights_card.dart';
import '../widgets/dashboard_v2_components.dart';
import '../widgets/dashboard_v2_tokens.dart';
import '../widgets/executive_charts.dart';
import '../widgets/greeting_header.dart';
import '../widgets/kpi_cards.dart';
import '../widgets/quick_actions.dart';
import '../widgets/recent_projects.dart';

/// Executive dashboard overview screen.
class ExecutiveDashboardScreen extends ConsumerWidget {
  const ExecutiveDashboardScreen({super.key});

  String _timeSlot(DateTime timestamp) {
    final minute = timestamp.minute.toString().padLeft(2, '0');
    final suffix = timestamp.hour >= 12 ? 'PM' : 'AM';
    final hour = timestamp.hour % 12 == 0 ? 12 : timestamp.hour % 12;
    return '$hour:$minute $suffix';
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
  Widget build(BuildContext context, WidgetRef ref) {
    final width = MediaQuery.sizeOf(context).width;
    final threeColumn = width >= 1240;
    final bottomThreeColumn = width >= 1180;
    final t = DashboardV2Tokens.of(context);

    final activities = ref.watch(dashboardActivitiesProvider);
    final insights = ref.watch(dashboardInsightsProvider);
    final notifications = ref.watch(dashboardNotificationsProvider);
    final unread = ref.watch(unreadNotificationsCountProvider);
    final projects = ref.watch(dashboardProjectsProvider);

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [t.backdrop, t.panel.withValues(alpha: 0.36), t.backdrop],
        ),
      ),
      child: PullToRefresh(
        onRefresh: () async => refreshDashboardData(ref),
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: t.pagePadding,
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 1380),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const GreetingHeader(),
                  const SizedBox(height: AppSpacing.lg),
                  const KpiCards(),
                  const SizedBox(height: AppSpacing.lg),
                  if (threeColumn)
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Expanded(flex: 6, child: ExecutiveCharts()),
                        const SizedBox(width: AppSpacing.md),
                        Expanded(
                          flex: 4,
                          child: _CenterColumn(
                            activities: activities,
                            notifications: notifications,
                            unread: unread,
                            timeFormatter: _timeSlot,
                            agoFormatter: _timeAgo,
                          ),
                        ),
                        const SizedBox(width: AppSpacing.md),
                        Expanded(
                          flex: 4,
                          child: _RightColumn(
                            insights: insights,
                            activities: activities,
                          ),
                        ),
                      ],
                    )
                  else ...[
                    const ExecutiveCharts(),
                    const SizedBox(height: AppSpacing.md),
                    _CenterColumn(
                      activities: activities,
                      notifications: notifications,
                      unread: unread,
                      timeFormatter: _timeSlot,
                      agoFormatter: _timeAgo,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    _RightColumn(insights: insights, activities: activities),
                  ],
                  const SizedBox(height: AppSpacing.lg),
                  if (bottomThreeColumn)
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Expanded(flex: 5, child: RecentProjects()),
                        const SizedBox(width: AppSpacing.md),
                        Expanded(
                          flex: 4,
                          child: _TeamActivityPanel(
                            projects: projects,
                            activities: activities,
                            agoFormatter: _timeAgo,
                          ),
                        ),
                        const SizedBox(width: AppSpacing.md),
                        const Expanded(flex: 4, child: QuickActions()),
                      ],
                    )
                  else ...[
                    const RecentProjects(),
                    const SizedBox(height: AppSpacing.md),
                    _TeamActivityPanel(
                      projects: projects,
                      activities: activities,
                      agoFormatter: _timeAgo,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    const QuickActions(),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _CenterColumn extends StatelessWidget {
  const _CenterColumn({
    required this.activities,
    required this.notifications,
    required this.unread,
    required this.timeFormatter,
    required this.agoFormatter,
  });

  final List<DashboardActivity> activities;
  final List<DashboardNotification> notifications;
  final int unread;
  final String Function(DateTime) timeFormatter;
  final String Function(DateTime) agoFormatter;

  @override
  Widget build(BuildContext context) {
    final t = DashboardV2Tokens.of(context);
    final agenda = activities.take(4).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const ActivityFeed(),
        const SizedBox(height: AppSpacing.md),
        DashboardGlassCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const DashboardSectionHeader(
                title: 'Calendar',
                subtitle: 'Today\'s executive timeline',
              ),
              const SizedBox(height: AppSpacing.sm),
              if (agenda.isEmpty)
                const DashboardEmptyState(
                  title: 'No scheduled items',
                  subtitle: 'Your executive calendar is clear for now.',
                  suggestion: 'Ask AI to draft your next schedule',
                  icon: Icons.event_available_rounded,
                )
              else
                for (final item in agenda)
                  Padding(
                    padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        DashboardStatusBadge(
                          label: timeFormatter(item.timestamp),
                          color: t.primary,
                          icon: Icons.schedule_rounded,
                        ),
                        const SizedBox(width: AppSpacing.xs),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                item.title,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: Theme.of(context).textTheme.bodyMedium
                                    ?.copyWith(
                                      color: t.textPrimary,
                                      fontWeight: FontWeight.w700,
                                    ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                item.subtitle,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: Theme.of(context).textTheme.bodySmall
                                    ?.copyWith(color: t.textSecondary),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        DashboardGlassCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              DashboardSectionHeader(
                title: 'Notifications',
                subtitle: 'Operational alerts and approvals',
                trailing: DashboardStatusBadge(
                  label: '$unread unread',
                  color: unread > 0 ? t.warning : t.success,
                  icon: unread > 0
                      ? Icons.notification_important_rounded
                      : Icons.check_circle_rounded,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              if (notifications.isEmpty)
                const DashboardEmptyState(
                  title: 'No notifications',
                  subtitle: 'New alerts will appear here as events arrive.',
                  suggestion: 'Enable AI alert digest',
                  icon: Icons.notifications_none_rounded,
                )
              else
                for (final note in notifications.take(4))
                  Container(
                    margin: const EdgeInsets.only(bottom: AppSpacing.xs),
                    padding: const EdgeInsets.all(AppSpacing.sm),
                    decoration: BoxDecoration(
                      color: t.panelStrong.withValues(alpha: 0.58),
                      borderRadius: BorderRadius.circular(t.radiusLg),
                      border: Border.all(
                        color: t.border.withValues(alpha: 0.8),
                      ),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(
                          note.read
                              ? Icons.mark_email_read_rounded
                              : Icons.mark_email_unread_rounded,
                          size: 16,
                          color: note.read ? t.textTertiary : t.warning,
                        ),
                        const SizedBox(width: AppSpacing.xs),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                note.title,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: Theme.of(context).textTheme.bodyMedium
                                    ?.copyWith(
                                      color: t.textPrimary,
                                      fontWeight: FontWeight.w700,
                                    ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                note.body,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: Theme.of(context).textTheme.bodySmall
                                    ?.copyWith(color: t.textSecondary),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: AppSpacing.xs),
                        Text(
                          agoFormatter(note.timestamp),
                          style: Theme.of(context).textTheme.labelSmall
                              ?.copyWith(
                                color: t.textTertiary,
                                fontWeight: FontWeight.w700,
                              ),
                        ),
                      ],
                    ),
                  ),
            ],
          ),
        ),
      ],
    );
  }
}

class _RightColumn extends StatelessWidget {
  const _RightColumn({required this.insights, required this.activities});

  final List<DashboardInsight> insights;
  final List<DashboardActivity> activities;

  @override
  Widget build(BuildContext context) {
    final t = DashboardV2Tokens.of(context);
    final alerts = activities
        .where((a) => a.type == ActivityType.alert)
        .take(3)
        .toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const AiInsightsCard(),
        const SizedBox(height: AppSpacing.md),
        DashboardGlassCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const DashboardSectionHeader(
                title: 'Priority Alerts',
                subtitle: 'Immediate intervention required',
              ),
              const SizedBox(height: AppSpacing.sm),
              if (alerts.isEmpty)
                const DashboardEmptyState(
                  title: 'No priority alerts',
                  subtitle: 'Critical risk queue is clear.',
                  suggestion: 'Ask AI to run a risk scan',
                  icon: Icons.task_alt_rounded,
                )
              else
                for (final alert in alerts)
                  Container(
                    margin: const EdgeInsets.only(bottom: AppSpacing.xs),
                    padding: const EdgeInsets.all(AppSpacing.sm),
                    decoration: BoxDecoration(
                      color: t.warning.withValues(alpha: 0.08),
                      borderRadius: BorderRadius.circular(t.radiusLg),
                      border: Border.all(
                        color: t.warning.withValues(alpha: 0.28),
                      ),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(
                          Icons.warning_amber_rounded,
                          color: t.warning,
                          size: 16,
                        ),
                        const SizedBox(width: AppSpacing.xs),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                alert.title,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: Theme.of(context).textTheme.bodyMedium
                                    ?.copyWith(
                                      color: t.textPrimary,
                                      fontWeight: FontWeight.w700,
                                    ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                alert.subtitle,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: Theme.of(context).textTheme.bodySmall
                                    ?.copyWith(color: t.textSecondary),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        DashboardGlassCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const DashboardSectionHeader(
                title: 'Executive Insights',
                subtitle: 'Confidence-ranked strategic signals',
              ),
              const SizedBox(height: AppSpacing.sm),
              if (insights.isEmpty)
                const DashboardEmptyState(
                  title: 'No executive insights yet',
                  subtitle: 'Insights populate after AI refresh.',
                  suggestion: 'Generate executive summary',
                  icon: Icons.auto_graph_rounded,
                )
              else
                for (final insight in insights.take(3))
                  Container(
                    margin: const EdgeInsets.only(bottom: AppSpacing.xs),
                    padding: const EdgeInsets.all(AppSpacing.sm),
                    decoration: BoxDecoration(
                      color: t.panelStrong.withValues(alpha: 0.58),
                      borderRadius: BorderRadius.circular(t.radiusLg),
                      border: Border.all(
                        color: t.border.withValues(alpha: 0.8),
                      ),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                insight.title,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: Theme.of(context).textTheme.bodyMedium
                                    ?.copyWith(
                                      color: t.textPrimary,
                                      fontWeight: FontWeight.w700,
                                    ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                insight.summary,
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: Theme.of(context).textTheme.bodySmall
                                    ?.copyWith(color: t.textSecondary),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: AppSpacing.xs),
                        DashboardStatusBadge(
                          label: '${insight.confidence}%',
                          color: t.primary,
                          icon: Icons.psychology_alt_rounded,
                        ),
                      ],
                    ),
                  ),
            ],
          ),
        ),
      ],
    );
  }
}

class _TeamActivityPanel extends StatelessWidget {
  const _TeamActivityPanel({
    required this.projects,
    required this.activities,
    required this.agoFormatter,
  });

  final List<DashboardProject> projects;
  final List<DashboardActivity> activities;
  final String Function(DateTime) agoFormatter;

  @override
  Widget build(BuildContext context) {
    return DashboardGlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const DashboardSectionHeader(
            title: 'Team Activity',
            subtitle: 'People execution and response velocity',
          ),
          const SizedBox(height: AppSpacing.sm),
          if (projects.isEmpty)
            const DashboardEmptyState(
              title: 'No team activity yet',
              subtitle: 'Execution telemetry appears here once active.',
              suggestion: 'Sync team workstreams',
              icon: Icons.groups_outlined,
            )
          else
            for (var i = 0; i < projects.take(4).length; i++)
              _TeamMemberTile(
                project: projects[i],
                referenceActivity: activities.isEmpty
                    ? null
                    : activities[i % activities.length],
                agoFormatter: agoFormatter,
              ),
        ],
      ),
    );
  }
}

class _TeamMemberTile extends StatelessWidget {
  const _TeamMemberTile({
    required this.project,
    required this.referenceActivity,
    required this.agoFormatter,
  });

  final DashboardProject project;
  final DashboardActivity? referenceActivity;
  final String Function(DateTime) agoFormatter;

  @override
  Widget build(BuildContext context) {
    final t = DashboardV2Tokens.of(context);

    return Container(
      margin: const EdgeInsets.only(bottom: AppSpacing.xs),
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: t.panelStrong.withValues(alpha: 0.55),
        borderRadius: BorderRadius.circular(t.radiusLg),
        border: Border.all(color: t.border.withValues(alpha: 0.8)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          DashboardOwnerAvatar(name: project.owner, size: 30),
          const SizedBox(width: AppSpacing.xs),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  project.owner,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: t.textPrimary,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  project.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: t.textSecondary),
                ),
                const SizedBox(height: AppSpacing.xs),
                ClipRRect(
                  borderRadius: BorderRadius.circular(999),
                  child: LinearProgressIndicator(
                    value: project.progress,
                    minHeight: 6,
                    backgroundColor: t.panel,
                    color: t.primary,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.xs),
          Text(
            referenceActivity == null
                ? 'Now'
                : agoFormatter(referenceActivity!.timestamp),
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: t.textTertiary,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}
