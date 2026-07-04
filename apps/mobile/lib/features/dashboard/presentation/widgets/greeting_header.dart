import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../auth/presentation/providers/auth_providers.dart';
import '../../../../router/routes.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/components/voltx_motion.dart';
import 'dashboard_v2_components.dart';
import 'dashboard_v2_tokens.dart';

/// Time-aware greeting with user name and date.
class GreetingHeader extends ConsumerWidget {
  const GreetingHeader({super.key});

  String _greeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) {
      return 'Good morning';
    }
    if (hour < 17) {
      return 'Good afternoon';
    }
    return 'Good evening';
  }

  String _formattedDate() {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December',
    ];
    const weekdays = [
      'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
    ];
    final now = DateTime.now();
    return '${weekdays[now.weekday - 1]}, ${months[now.month - 1]} ${now.day}';
  }

  String _formattedTime() {
    final now = DateTime.now();
    final minute = now.minute.toString().padLeft(2, '0');
    final suffix = now.hour >= 12 ? 'PM' : 'AM';
    final hour = now.hour % 12 == 0 ? 12 : now.hour % 12;
    return '$hour:$minute $suffix';
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final t = DashboardV2Tokens.of(context);
    final textTheme = Theme.of(context).textTheme;
    final user = ref.watch(authSessionProvider);
    final name = user?.firstName ?? 'Executive';
    final chips = [
      ('Focus', '3 priorities'),
      ('Risks', '2 items'),
      ('Ops Readiness', '94%'),
    ];

    return DashboardGlassCard(
      highlighted: true,
      child: VoltxFadeIn(
        child: Container(
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(t.radiusXl),
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                t.primary.withValues(alpha: 0.18),
                t.glow.withValues(alpha: 0.12),
                Colors.transparent,
              ],
            ),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              LayoutBuilder(
                builder: (context, constraints) {
                  final compact = constraints.maxWidth < 760;
                  final meta = Wrap(
                    spacing: AppSpacing.xs,
                    runSpacing: AppSpacing.xs,
                    children: [
                      DashboardStatusBadge(
                        label: _formattedDate(),
                        color: t.textSecondary,
                        icon: Icons.calendar_today_rounded,
                      ),
                      DashboardStatusBadge(
                        label: _formattedTime(),
                        color: t.primary,
                        icon: Icons.schedule_rounded,
                      ),
                      DashboardStatusBadge(
                        label: 'System Healthy',
                        color: t.success,
                        icon: Icons.health_and_safety_rounded,
                      ),
                      DashboardStatusBadge(
                        label: 'AI Briefing Ready',
                        color: t.primary,
                        icon: Icons.auto_awesome_rounded,
                      ),
                    ],
                  );

                  final left = Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${_greeting()}, $name',
                        style: textTheme.headlineMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                          color: t.textPrimary,
                          height: 1.05,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        'AI daily briefing: growth momentum remains positive, two execution risks need attention, and three high-leverage actions are recommended before noon.',
                        style: textTheme.bodyMedium?.copyWith(
                          color: t.textSecondary,
                          height: 1.42,
                        ),
                      ),
                    ],
                  );

                  if (compact) {
                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [left, const SizedBox(height: AppSpacing.sm), meta],
                    );
                  }

                  return Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(child: left),
                      const SizedBox(width: AppSpacing.md),
                      SizedBox(width: 360, child: meta),
                    ],
                  );
                },
              ),
              const SizedBox(height: AppSpacing.md),
              Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                children: [
                  for (final chip in chips)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.sm,
                        vertical: AppSpacing.xs,
                      ),
                      decoration: BoxDecoration(
                        color: t.panelStrong.withValues(alpha: 0.66),
                        borderRadius: BorderRadius.circular(t.radiusLg),
                        border: Border.all(color: t.border),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            chip.$1,
                            style: textTheme.labelSmall?.copyWith(
                              color: t.textTertiary,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            chip.$2,
                            style: textTheme.bodySmall?.copyWith(
                              color: t.textPrimary,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                children: [
                  _HeroQuickAction(
                    label: 'Run AI Brief',
                    icon: Icons.auto_awesome_rounded,
                    onTap: () => context.go(AppRoutes.aiChat),
                  ),
                  _HeroQuickAction(
                    label: 'Review Alerts',
                    icon: Icons.notification_important_outlined,
                    onTap: () => context.go(AppRoutes.dashboardNotifications),
                  ),
                  _HeroQuickAction(
                    label: 'Open Pipeline',
                    icon: Icons.stacked_line_chart_rounded,
                    onTap: () => context.go(AppRoutes.salesOpportunityBoard),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _HeroQuickAction extends StatelessWidget {
  const _HeroQuickAction({
    required this.label,
    required this.icon,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = DashboardV2Tokens.of(context);

    return VoltxPressable(
      onTap: onTap,
      borderRadius: BorderRadius.circular(t.radiusLg),
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.sm,
          vertical: AppSpacing.xs,
        ),
        decoration: BoxDecoration(
          color: t.primary.withValues(alpha: 0.14),
          borderRadius: BorderRadius.circular(t.radiusLg),
          border: Border.all(color: t.primary.withValues(alpha: 0.32)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 16, color: t.primary),
            const SizedBox(width: AppSpacing.xs),
            Text(
              label,
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: t.textPrimary,
                    fontWeight: FontWeight.w700,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}
