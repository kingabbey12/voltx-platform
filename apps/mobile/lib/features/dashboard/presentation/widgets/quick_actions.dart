import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../router/routes.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/components/voltx_motion.dart';
import 'dashboard_v2_components.dart';
import 'dashboard_v2_tokens.dart';

/// Quick action shortcuts for common tasks.
class QuickActions extends StatelessWidget {
  const QuickActions({super.key});

  static const _actions = [
    _QuickAction(
      Icons.auto_awesome_rounded,
      'Ask AI',
      AppRoutes.aiChat,
      'Run executive analysis',
    ),
    _QuickAction(
      Icons.insights_outlined,
      'Pipeline Board',
      AppRoutes.salesOpportunityBoard,
      'Review deal movement',
    ),
    _QuickAction(
      Icons.notifications_outlined,
      'Alerts',
      AppRoutes.dashboardNotifications,
      'Resolve critical items',
    ),
    _QuickAction(
      Icons.search_rounded,
      'Search',
      AppRoutes.dashboardSearch,
      'Find projects fast',
    ),
    _QuickAction(
      Icons.inventory_2_outlined,
      'Lead Pipeline',
      AppRoutes.salesPipeline,
      'Prioritize follow-ups',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final t = DashboardV2Tokens.of(context);

    return DashboardGlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const DashboardSectionHeader(
            title: 'AI Suggested Actions',
            subtitle: 'Recommended next moves based on live signals',
          ),
          const SizedBox(height: AppSpacing.md),
          LayoutBuilder(
            builder: (context, constraints) {
              final compact = constraints.maxWidth < 640;
              final columns = compact ? 2 : 5;
              final width = (constraints.maxWidth - ((columns - 1) * AppSpacing.sm)) / columns;

              return Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                children: [
                  for (final action in _actions)
                    SizedBox(
                      width: width,
                      child: VoltxPressable(
                        onTap: () => context.go(action.route),
                        borderRadius: BorderRadius.circular(t.radiusLg),
                        child: Container(
                          padding: const EdgeInsets.all(AppSpacing.sm),
                          decoration: BoxDecoration(
                            color: t.panelStrong.withValues(alpha: 0.55),
                            borderRadius: BorderRadius.circular(t.radiusLg),
                            border: Border.all(color: t.border.withValues(alpha: 0.9)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Container(
                                width: 34,
                                height: 34,
                                decoration: BoxDecoration(
                                  color: t.primary.withValues(alpha: 0.14),
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: Icon(action.icon, size: 18, color: t.primary),
                              ),
                              const SizedBox(height: AppSpacing.xs),
                              Text(
                                action.label,
                                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                      color: t.textPrimary,
                                      fontWeight: FontWeight.w700,
                                    ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 2),
                              Text(
                                action.hint,
                                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                      color: t.textSecondary,
                                    ),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ),
                        ),
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

class _QuickAction {
  const _QuickAction(this.icon, this.label, this.route, this.hint);
  final IconData icon;
  final String label;
  final String route;
  final String hint;
}
