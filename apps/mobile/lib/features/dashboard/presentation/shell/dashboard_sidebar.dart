import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../config/app_config.dart';
import '../../../../router/routes.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';
import '../../../../theme/components/voltx_motion.dart';
import '../providers/dashboard_providers.dart';

class DashboardNavItem {
  const DashboardNavItem({
    required this.label,
    required this.route,
    required this.icon,
    required this.selectedIcon,
    this.badge,
  });

  final String label;
  final String route;
  final IconData icon;
  final IconData selectedIcon;
  final String? badge;
}

/// Left collapsible sidebar for desktop dashboard layout.
class DashboardSidebar extends ConsumerWidget {
  const DashboardSidebar({super.key});

  static const items = [
    DashboardNavItem(
      label: 'Dashboard',
      route: AppRoutes.dashboard,
      icon: Icons.dashboard_outlined,
      selectedIcon: Icons.dashboard_rounded,
    ),
    DashboardNavItem(
      label: 'Sales Copilot',
      route: AppRoutes.salesDashboard,
      icon: Icons.insights_outlined,
      selectedIcon: Icons.insights_rounded,
    ),
    DashboardNavItem(
      label: 'AI Workspace',
      route: AppRoutes.aiHome,
      icon: Icons.auto_awesome_outlined,
      selectedIcon: Icons.auto_awesome_rounded,
    ),
    DashboardNavItem(
      label: 'Notifications',
      route: AppRoutes.dashboardNotifications,
      icon: Icons.notifications_outlined,
      selectedIcon: Icons.notifications_rounded,
      badge: '3',
    ),
    DashboardNavItem(
      label: 'Search',
      route: AppRoutes.dashboardSearch,
      icon: Icons.search_rounded,
      selectedIcon: Icons.search_rounded,
    ),
    DashboardNavItem(
      label: 'Profile',
      route: AppRoutes.dashboardProfile,
      icon: Icons.person_outline_rounded,
      selectedIcon: Icons.person_rounded,
    ),
    DashboardNavItem(
      label: 'Settings',
      route: AppRoutes.settings,
      icon: Icons.settings_outlined,
      selectedIcon: Icons.settings_rounded,
    ),
  ];

  bool _isSelected(String location, String route) {
    if (route == AppRoutes.dashboard) {
      return location == route;
    }
    if (route == AppRoutes.aiHome) {
      return location.startsWith('/ai');
    }
    if (route == AppRoutes.salesDashboard) {
      return location.startsWith('/sales');
    }
    return location.startsWith(route);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.voltxColors;
    final scheme = Theme.of(context).colorScheme;
    final collapsed = ref.watch(dashboardShellProvider).sidebarCollapsed;
    final unread = ref.watch(unreadNotificationsCountProvider);
    final location = GoRouterState.of(context).uri.toString();

    return VoltxSidebarCollapse(
      collapsed: collapsed,
      collapsedWidth: AppSpacing.leftRailCollapsed,
      expandedWidth: AppSpacing.leftRailExpanded,
      child: Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [
              colors.surfaceElevated.withValues(alpha: 0.96),
              colors.surfaceMuted.withValues(alpha: 0.86),
            ],
          ),
          border: Border(right: BorderSide(color: colors.borderSubtle.withValues(alpha: 0.9))),
        ),
        child: SafeArea(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.all(AppSpacing.sm),
                child: Row(
                  children: [
                    Container(
                      width: 34,
                      height: 34,
                      decoration: BoxDecoration(
                        color: scheme.primary.withValues(alpha: 0.14),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(Icons.bolt_rounded, color: scheme.primary, size: 20),
                    ),
                    if (!collapsed) ...[
                      const SizedBox(width: AppSpacing.xs),
                      Expanded(
                        child: Text(
                          AppConfig.appName,
                          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                fontWeight: FontWeight.w800,
                              ),
                        ),
                      ),
                      _buildOrgBadge(context),
                    ],
                    IconButton(
                      icon: Icon(
                        collapsed ? Icons.menu_rounded : Icons.menu_open_rounded,
                      ),
                      tooltip: collapsed ? 'Expand sidebar' : 'Collapse sidebar',
                      onPressed: () =>
                          ref.read(dashboardShellProvider.notifier).toggleSidebar(),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.xs),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                  children: [
                    for (final item in items)
                      _SidebarTile(
                        item: item,
                        selected: _isSelected(location, item.route),
                        collapsed: collapsed,
                        badge: item.route == AppRoutes.dashboardNotifications && unread > 0
                            ? (unread > 99 ? '99+' : '$unread')
                            : item.badge,
                        onTap: () => context.go(item.route),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildOrgBadge(BuildContext context) {
    final colors = context.voltxColors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs, vertical: AppSpacing.xxs),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        color: colors.surfaceMuted.withValues(alpha: 0.75),
        border: Border.all(color: colors.borderSubtle),
      ),
      child: Text(
        'PRO',
        style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: colors.textSecondary,
              fontWeight: FontWeight.w700,
            ),
      ),
    );
  }
}

class _SidebarTile extends StatelessWidget {
  const _SidebarTile({
    required this.item,
    required this.selected,
    required this.collapsed,
    this.badge,
    required this.onTap,
  });

  final DashboardNavItem item;
  final bool selected;
  final bool collapsed;
  final String? badge;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.voltxColors;
    final scheme = Theme.of(context).colorScheme;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs, vertical: 2),
      child: VoltxPressable(
        borderRadius: BorderRadius.circular(10),
        onTap: onTap,
        child: AnimatedContainer(
          duration: context.voltxMotion.fast,
          curve: context.voltxMotion.standardCurve,
          decoration: BoxDecoration(
            color: selected ? scheme.primary.withValues(alpha: 0.13) : Colors.transparent,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: selected
                  ? scheme.primary.withValues(alpha: 0.3)
                  : Colors.transparent,
            ),
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.sm,
              vertical: AppSpacing.sm,
            ),
            child: Row(
              children: [
                AnimatedContainer(
                  duration: context.voltxMotion.fast,
                  width: 3,
                  height: 18,
                  margin: const EdgeInsets.only(right: AppSpacing.xs),
                  decoration: BoxDecoration(
                    color: selected ? scheme.primary : Colors.transparent,
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
                Icon(
                  selected ? item.selectedIcon : item.icon,
                  size: 20,
                  color: selected ? scheme.primary : colors.textSecondary,
                ),
                if (!collapsed) ...[
                  const SizedBox(width: AppSpacing.xs),
                  Expanded(
                    child: Text(
                      item.label,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: selected ? scheme.primary : colors.textPrimary,
                            fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                          ),
                    ),
                  ),
                  if (badge != null)
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.xs,
                        vertical: 2,
                      ),
                      decoration: BoxDecoration(
                        color: selected
                            ? scheme.primary.withValues(alpha: 0.16)
                            : colors.surfaceMuted,
                        borderRadius: BorderRadius.circular(999),
                        border: Border.all(
                          color: selected
                              ? scheme.primary.withValues(alpha: 0.28)
                              : colors.borderSubtle,
                        ),
                      ),
                      child: Text(
                        badge!,
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                              color: selected ? scheme.primary : colors.textSecondary,
                              fontWeight: FontWeight.w700,
                            ),
                      ),
                    ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
