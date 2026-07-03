import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../router/routes.dart';
import '../../../../theme/components/voltx_card.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';

/// Quick action shortcuts for common tasks.
class QuickActions extends StatelessWidget {
  const QuickActions({super.key});

  static const _actions = [
    _QuickAction(Icons.auto_awesome_rounded, 'Ask AI', AppRoutes.aiChat),
    _QuickAction(Icons.notifications_outlined, 'Alerts', AppRoutes.dashboardNotifications),
    _QuickAction(Icons.search_rounded, 'Search', AppRoutes.dashboardSearch),
    _QuickAction(Icons.assessment_outlined, 'Reports', AppRoutes.dashboard),
  ];

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return VoltxCard(
      padding: const EdgeInsets.all(AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Quick Actions', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.sm,
            children: [
              for (final action in _actions)
                ActionChip(
                  avatar: Icon(action.icon, size: 18, color: scheme.primary),
                  label: Text(action.label),
                  onPressed: () => context.go(action.route),
                  backgroundColor: scheme.primary.withValues(alpha: 0.08),
                  side: BorderSide(color: context.voltxColors.borderSubtle),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _QuickAction {
  const _QuickAction(this.icon, this.label, this.route);
  final IconData icon;
  final String label;
  final String route;
}
