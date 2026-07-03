import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../config/app_config.dart';
import '../../../../router/routes.dart';
import '../../../../theme/tokens/motion_tokens.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';
import '../providers/dashboard_providers.dart';

class DashboardNavItem {
  const DashboardNavItem({
    required this.label,
    required this.route,
    required this.icon,
    required this.selectedIcon,
  });

  final String label;
  final String route;
  final IconData icon;
  final IconData selectedIcon;
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
      label: 'AI Workspace',
      route: AppRoutes.dashboardAi,
      icon: Icons.auto_awesome_outlined,
      selectedIcon: Icons.auto_awesome_rounded,
    ),
    DashboardNavItem(
      label: 'Notifications',
      route: AppRoutes.dashboardNotifications,
      icon: Icons.notifications_outlined,
      selectedIcon: Icons.notifications_rounded,
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
    return location.startsWith(route);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.voltxColors;
    final scheme = Theme.of(context).colorScheme;
    final collapsed = ref.watch(dashboardShellProvider).sidebarCollapsed;
    final location = GoRouterState.of(context).uri.toString();
    final width = collapsed ? 72.0 : 240.0;

    return AnimatedContainer(
      duration: MotionTokens.normal,
      curve: MotionTokens.standard,
      width: width,
      decoration: BoxDecoration(
        color: colors.surfaceElevated,
        border: Border(right: BorderSide(color: colors.borderSubtle)),
      ),
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.all(AppSpacing.sm),
              child: Row(
                children: [
                  Icon(Icons.bolt_rounded, color: scheme.primary, size: 28),
                  if (!collapsed) ...[
                    const SizedBox(width: AppSpacing.xs),
                    Expanded(
                      child: Text(
                        AppConfig.appName,
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                      ),
                    ),
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
            const SizedBox(height: AppSpacing.sm),
            for (final item in items)
              _SidebarTile(
                item: item,
                selected: _isSelected(location, item.route),
                collapsed: collapsed,
                onTap: () => context.go(item.route),
              ),
          ],
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
    required this.onTap,
  });

  final DashboardNavItem item;
  final bool selected;
  final bool collapsed;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.voltxColors;
    final scheme = Theme.of(context).colorScheme;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs, vertical: 2),
      child: Material(
        color: selected ? scheme.primary.withValues(alpha: 0.1) : Colors.transparent,
        borderRadius: BorderRadius.circular(10),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(10),
          child: Padding(
            padding: EdgeInsets.symmetric(
              horizontal: collapsed ? AppSpacing.sm : AppSpacing.sm,
              vertical: AppSpacing.sm,
            ),
            child: Row(
              children: [
                Icon(
                  selected ? item.selectedIcon : item.icon,
                  size: 22,
                  color: selected ? scheme.primary : colors.textSecondary,
                ),
                if (!collapsed) ...[
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Text(
                      item.label,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: selected ? scheme.primary : colors.textPrimary,
                            fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
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
