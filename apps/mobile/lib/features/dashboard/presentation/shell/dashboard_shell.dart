import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../router/routes.dart';
import '../../../../shared/widgets/offline_banner.dart';
import '../../../../shared/widgets/responsive_layout.dart';
import '../../../../theme/components/voltx_navigation.dart';
import '../providers/dashboard_providers.dart';
import 'dashboard_ai_panel.dart';
import 'dashboard_command_bar.dart';
import 'dashboard_mobile_drawer.dart';
import 'dashboard_sidebar.dart';

/// Responsive executive dashboard shell.
class DashboardShell extends ConsumerWidget {
  const DashboardShell({required this.child, super.key});

  final Widget child;

  static const _mobileRoutes = [
    AppRoutes.dashboard,
    AppRoutes.dashboardNotifications,
    AppRoutes.dashboardSearch,
    AppRoutes.dashboardProfile,
  ];

  static const _mobileDestinations = [
    VoltxNavigationDestination(
      icon: Icons.dashboard_outlined,
      selectedIcon: Icons.dashboard_rounded,
      label: 'Dashboard',
    ),
    VoltxNavigationDestination(
      icon: Icons.notifications_outlined,
      selectedIcon: Icons.notifications_rounded,
      label: 'Alerts',
    ),
    VoltxNavigationDestination(
      icon: Icons.search_rounded,
      selectedIcon: Icons.search_rounded,
      label: 'Search',
    ),
    VoltxNavigationDestination(
      icon: Icons.person_outline_rounded,
      selectedIcon: Icons.person_rounded,
      label: 'Profile',
    ),
  ];

  int _mobileIndex(String location) {
    if (location.startsWith(AppRoutes.dashboardNotifications)) {
      return 1;
    }
    if (location.startsWith(AppRoutes.dashboardSearch)) {
      return 2;
    }
    if (location.startsWith(AppRoutes.dashboardProfile)) {
      return 3;
    }
    return 0;
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isMobile = currentBreakpoint(context) == AppBreakpoint.compact;
    final shellState = ref.watch(dashboardShellProvider);
    final location = GoRouterState.of(context).uri.toString();

    if (isMobile) {
      return DashboardShortcuts(
        child: Scaffold(
          drawer: const DashboardMobileDrawer(),
          body: Column(
            children: [
              const OfflineBanner(),
              const DashboardCommandBar(compact: true),
              Expanded(child: child),
            ],
          ),
          bottomNavigationBar: VoltxNavigationBar(
            selectedIndex: _mobileIndex(location),
            destinations: _mobileDestinations,
            onDestinationSelected: (index) {
              final route = _mobileRoutes[index];
              if (location != route) {
                context.go(route);
              }
            },
          ),
          floatingActionButton: FloatingActionButton.extended(
            onPressed: () => context.go(AppRoutes.aiChat),
            icon: const Icon(Icons.auto_awesome_rounded),
            label: const Text('AI'),
          ),
        ),
      );
    }

    return DashboardShortcuts(
      child: Scaffold(
        body: Row(
          children: [
            const DashboardSidebar(),
            Expanded(
              child: Column(
                children: [
                  const OfflineBanner(),
                  const DashboardCommandBar(),
                  Expanded(child: child),
                ],
              ),
            ),
            AnimatedSwitcher(
              duration: const Duration(milliseconds: 280),
              switchInCurve: Curves.easeOutCubic,
              switchOutCurve: Curves.easeInCubic,
              transitionBuilder: (child, animation) => SizeTransition(
                sizeFactor: animation,
                axis: Axis.horizontal,
                child: FadeTransition(opacity: animation, child: child),
              ),
              child: shellState.aiPanelOpen
                  ? const DashboardAiPanel(key: ValueKey('ai-panel'))
                  : const SizedBox.shrink(key: ValueKey('ai-closed')),
            ),
          ],
        ),
      ),
    );
  }
}
