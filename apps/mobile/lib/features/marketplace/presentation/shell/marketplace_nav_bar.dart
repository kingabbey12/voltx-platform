import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../router/routes.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';

/// Marketplace sub-navigation bar — mirrors BillingNavBar's pattern.
class MarketplaceNavBar extends StatelessWidget {
  const MarketplaceNavBar({super.key});

  static const _items = [
    _NavItem('Browse', AppRoutes.marketplaceHome, Icons.storefront_outlined, Icons.storefront_rounded),
    _NavItem(
      'Installed',
      AppRoutes.marketplaceInstalled,
      Icons.download_done_outlined,
      Icons.download_done_rounded,
    ),
    _NavItem('My Apps', AppRoutes.marketplaceMyApps, Icons.apps_outlined, Icons.apps_rounded),
    _NavItem(
      'Payouts',
      AppRoutes.marketplacePayouts,
      Icons.account_balance_outlined,
      Icons.account_balance_rounded,
    ),
  ];

  bool _isSelected(String location, String route) {
    if (route == AppRoutes.marketplaceHome) {
      return location == route;
    }
    return location == route || location.startsWith('$route/');
  }

  @override
  Widget build(BuildContext context) {
    final location = GoRouterState.of(context).uri.toString();
    final scheme = Theme.of(context).colorScheme;
    final colors = context.voltxColors;

    return SizedBox(
      height: 56,
      child: ListView(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
        scrollDirection: Axis.horizontal,
        children: [
          for (final item in _items)
            Padding(
              padding: const EdgeInsets.only(right: AppSpacing.xs),
              child: ActionChip(
                avatar: Icon(
                  _isSelected(location, item.route) ? item.selectedIcon : item.icon,
                  size: 18,
                  color: _isSelected(location, item.route) ? scheme.primary : colors.textSecondary,
                ),
                label: Text(item.label),
                labelStyle: TextStyle(
                  color: _isSelected(location, item.route) ? scheme.primary : colors.textPrimary,
                  fontWeight: _isSelected(location, item.route) ? FontWeight.w700 : FontWeight.w500,
                ),
                backgroundColor: _isSelected(location, item.route)
                    ? scheme.primary.withValues(alpha: 0.12)
                    : colors.surfaceMuted,
                side: BorderSide(
                  color: _isSelected(location, item.route)
                      ? scheme.primary.withValues(alpha: 0.3)
                      : colors.borderSubtle,
                ),
                onPressed: () => context.go(item.route),
              ),
            ),
        ],
      ),
    );
  }
}

class _NavItem {
  const _NavItem(this.label, this.route, this.icon, this.selectedIcon);
  final String label;
  final String route;
  final IconData icon;
  final IconData selectedIcon;
}
