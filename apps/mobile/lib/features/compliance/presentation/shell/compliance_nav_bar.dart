import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../router/routes.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';

/// Compliance Center sub-navigation bar — mirrors BillingNavBar's pattern.
class ComplianceNavBar extends StatelessWidget {
  const ComplianceNavBar({super.key});

  static const _items = [
    _NavItem('Consent', AppRoutes.complianceHome, Icons.fact_check_outlined, Icons.fact_check_rounded),
    _NavItem('GDPR', AppRoutes.complianceGdpr, Icons.privacy_tip_outlined, Icons.privacy_tip_rounded),
    _NavItem(
      'Legal Holds',
      AppRoutes.complianceLegalHolds,
      Icons.gavel_outlined,
      Icons.gavel_rounded,
    ),
    _NavItem('Audit', AppRoutes.complianceAudit, Icons.verified_outlined, Icons.verified_rounded),
    _NavItem(
      'Retention',
      AppRoutes.complianceRetention,
      Icons.auto_delete_outlined,
      Icons.auto_delete_rounded,
    ),
  ];

  bool _isSelected(String location, String route) {
    if (route == AppRoutes.complianceHome) {
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
