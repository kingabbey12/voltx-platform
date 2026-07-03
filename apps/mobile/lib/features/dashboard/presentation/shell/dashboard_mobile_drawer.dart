import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../config/app_config.dart';
import '../../../../router/routes.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';
import 'dashboard_sidebar.dart';

/// Slide-out drawer for mobile dashboard navigation.
class DashboardMobileDrawer extends StatelessWidget {
  const DashboardMobileDrawer({super.key});

  bool _isSelected(String location, String route) {
    if (route == AppRoutes.dashboard) {
      return location == route;
    }
    return location.startsWith(route);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.voltxColors;
    final scheme = Theme.of(context).colorScheme;
    final location = GoRouterState.of(context).uri.toString();

    return Drawer(
      backgroundColor: colors.surfaceElevated,
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Row(
                children: [
                  Icon(Icons.bolt_rounded, color: scheme.primary, size: 32),
                  const SizedBox(width: AppSpacing.sm),
                  Text(
                    AppConfig.appName,
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            for (final item in DashboardSidebar.items)
              ListTile(
                leading: Icon(
                  _isSelected(location, item.route)
                      ? item.selectedIcon
                      : item.icon,
                  color: _isSelected(location, item.route)
                      ? scheme.primary
                      : colors.textSecondary,
                ),
                title: Text(item.label),
                selected: _isSelected(location, item.route),
                onTap: () {
                  Navigator.of(context).pop();
                  context.go(item.route);
                },
              ),
          ],
        ),
      ),
    );
  }
}
