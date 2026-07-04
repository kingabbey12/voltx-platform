import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/components/voltx_motion.dart';
import '../../data/models/dashboard_models.dart';
import '../providers/dashboard_providers.dart';
import 'dashboard_v2_components.dart';
import 'dashboard_v2_tokens.dart';

/// Recent projects list with progress indicators.
class RecentProjects extends ConsumerWidget {
  const RecentProjects({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final projects = ref.watch(dashboardProjectsProvider);

    return DashboardGlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const DashboardSectionHeader(
            title: 'Recent Projects',
            subtitle: 'Delivery momentum and risk signals',
          ),
          const SizedBox(height: AppSpacing.sm),
          if (projects.isEmpty)
            const DashboardEmptyState(
              title: 'No projects in scope',
              subtitle: 'Project progress will be shown once available.',
              suggestion: 'Create an AI project health report',
              icon: Icons.layers_outlined,
            ),
          for (var i = 0; i < projects.length; i++) ...[
            VoltxSlideIn(
              begin: const Offset(0, 0.03),
              child: _ProjectTile(project: projects[i]),
            ),
            if (i < projects.length - 1) const SizedBox(height: AppSpacing.sm),
          ],
        ],
      ),
    );
  }
}

class _ProjectTile extends StatelessWidget {
  const _ProjectTile({required this.project});

  final DashboardProject project;

  Color _statusColor(BuildContext context) {
    final t = DashboardV2Tokens.of(context);
    return project.status == 'At risk' ? t.warning : t.success;
  }

  @override
  Widget build(BuildContext context) {
    final t = DashboardV2Tokens.of(context);
    final color = _statusColor(context);
    final avatarNames = [project.owner, 'Ops AI', 'Finance'];

    return VoltxPressable(
      borderRadius: BorderRadius.circular(t.radiusLg),
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.sm),
        decoration: BoxDecoration(
          color: t.panelStrong.withValues(alpha: 0.55),
          borderRadius: BorderRadius.circular(t.radiusLg),
          border: Border.all(color: t.border.withValues(alpha: 0.8)),
        ),
        child: LayoutBuilder(
          builder: (context, constraints) {
            final compact = constraints.maxWidth < 320;

            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (compact) ...[
                  Text(
                    project.name,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          fontWeight: FontWeight.w700,
                          color: t.textPrimary,
                        ),
                  ),
                  const SizedBox(height: AppSpacing.xxs),
                  DashboardStatusBadge(label: project.status, color: color),
                ] else
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          project.name,
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                fontWeight: FontWeight.w700,
                                color: t.textPrimary,
                              ),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.xs),
                      DashboardStatusBadge(label: project.status, color: color),
                    ],
                  ),
                const SizedBox(height: AppSpacing.xs),
                Row(
                  children: [
                    DashboardOwnerAvatar(name: project.owner),
                    const SizedBox(width: AppSpacing.xs),
                    Expanded(
                      child: Text(
                        project.owner,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: t.textSecondary,
                            ),
                        maxLines: compact ? 2 : 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    DashboardAvatarGroup(names: avatarNames),
                  ],
                ),
                const SizedBox(height: AppSpacing.sm),
                ClipRRect(
                  borderRadius: BorderRadius.circular(999),
                  child: LinearProgressIndicator(
                    value: project.progress,
                    minHeight: 7,
                    backgroundColor: t.panel,
                    color: t.primary,
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                Row(
                  children: [
                    Text(
                      '${(project.progress * 100).round()}% complete',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: t.textTertiary,
                          ),
                    ),
                    const Spacer(),
                    Text(
                      project.status == 'At risk' ? 'Last activity: 24m ago' : 'Last activity: 8m ago',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: t.textSecondary,
                            fontWeight: FontWeight.w600,
                          ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.xs),
                SizedBox(
                  width: compact ? double.infinity : 110,
                  child: DashboardSparkline(
                    values: [
                      (project.progress - 0.18).clamp(0.05, 1),
                      (project.progress - 0.1).clamp(0.05, 1),
                      (project.progress - 0.04).clamp(0.05, 1),
                      project.progress,
                    ],
                    color: color,
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}
