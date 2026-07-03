import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../router/routes.dart';
import '../../theme/components/voltx_navigation.dart';
import 'offline_banner.dart';

/// Root navigation shell with bottom bar and offline banner.
class AppShell extends StatelessWidget {
  const AppShell({
    required this.child,
    super.key,
  });

  final Widget child;

  static const _destinations = [
    VoltxNavigationDestination(
      icon: Icons.home_outlined,
      selectedIcon: Icons.home_rounded,
      label: 'Home',
    ),
    VoltxNavigationDestination(
      icon: Icons.widgets_outlined,
      selectedIcon: Icons.widgets_rounded,
      label: 'Components',
    ),
    VoltxNavigationDestination(
      icon: Icons.settings_outlined,
      selectedIcon: Icons.settings_rounded,
      label: 'Settings',
    ),
  ];

  static const _routes = [
    AppRoutes.home,
    AppRoutes.components,
    AppRoutes.settings,
  ];

  int _selectedIndex(String location) {
    if (location.startsWith(AppRoutes.components)) {
      return 1;
    }
    if (location.startsWith(AppRoutes.settings)) {
      return 2;
    }
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    final location = GoRouterState.of(context).uri.toString();
    final selectedIndex = _selectedIndex(location);

    return Scaffold(
      body: Column(
        children: [
          const OfflineBanner(),
          Expanded(child: child),
        ],
      ),
      bottomNavigationBar: VoltxNavigationBar(
        selectedIndex: selectedIndex,
        destinations: _destinations,
        onDestinationSelected: (index) {
          final route = _routes[index];
          if (location != route && !location.startsWith('$route/')) {
            context.go(route);
          }
        },
      ),
    );
  }
}
