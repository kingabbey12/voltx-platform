import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../theme/components/voltx_card.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';
import '../../data/models/dashboard_models.dart';
import '../providers/dashboard_providers.dart';

/// Recent projects list with progress indicators.
class RecentProjects extends ConsumerWidget {
  const RecentProjects({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final projects = ref.watch(dashboardProjectsProvider);

    return VoltxCard(
      padding: const EdgeInsets.all(AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Recent Projects', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: AppSpacing.sm),
          for (var i = 0; i < projects.length; i++) ...[
            _ProjectTile(project: projects[i]),
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
    final colors = context.voltxColors;
    return project.status == 'At risk' ? colors.warning : colors.success;
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.voltxColors;
    final scheme = Theme.of(context).colorScheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: Text(
                project.name,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
              decoration: BoxDecoration(
                color: _statusColor(context).withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                project.status,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: _statusColor(context),
                      fontWeight: FontWeight.w600,
                    ),
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.xxs),
        Text(
          project.owner,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.textSecondary),
        ),
        const SizedBox(height: AppSpacing.xs),
        ClipRRect(
          borderRadius: BorderRadius.circular(999),
          child: LinearProgressIndicator(
            value: project.progress,
            minHeight: 6,
            backgroundColor: colors.surfaceMuted,
            color: scheme.primary,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          '${(project.progress * 100).round()}% complete',
          style: Theme.of(context).textTheme.labelSmall?.copyWith(color: colors.textTertiary),
        ),
      ],
    );
  }
}
