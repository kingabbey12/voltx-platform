import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../router/routes.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';

/// AI section sub-navigation bar.
class AiNavBar extends StatelessWidget {
  const AiNavBar({this.compact = false, super.key});

  final bool compact;

  static const _items = [
    _NavItem('Home', AppRoutes.aiHome, Icons.home_outlined, Icons.home_rounded),
    _NavItem('Chat', AppRoutes.aiChat, Icons.chat_outlined, Icons.chat_rounded),
    _NavItem('Agents', AppRoutes.aiAgents, Icons.smart_toy_outlined, Icons.smart_toy_rounded),
    _NavItem('Knowledge', AppRoutes.aiKnowledge, Icons.menu_book_outlined, Icons.menu_book_rounded),
    _NavItem('Automations', AppRoutes.aiAutomations, Icons.bolt_outlined, Icons.bolt_rounded),
    _NavItem('History', AppRoutes.aiHistory, Icons.history_rounded, Icons.history_rounded),
  ];

  bool _isSelected(String location, String route) {
    if (route == AppRoutes.aiHome) {
      return location == route;
    }
    return location == route || location.startsWith('$route/');
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.voltxColors;
    final location = GoRouterState.of(context).uri.toString();

    return Container(
      height: compact ? 48 : 52,
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
      decoration: BoxDecoration(
        color: colors.surfaceElevated,
        border: Border(bottom: BorderSide(color: colors.borderSubtle)),
      ),
      child: ListView(
        scrollDirection: Axis.horizontal,
        children: [
          for (final item in _items)
            Padding(
              padding: const EdgeInsets.only(right: AppSpacing.xxs),
              child: TextButton(
                onPressed: () => context.go(item.route),
                style: TextButton.styleFrom(
                  foregroundColor: _isSelected(location, item.route)
                      ? Theme.of(context).colorScheme.primary
                      : colors.textSecondary,
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      _isSelected(location, item.route)
                          ? item.selectedIcon
                          : item.icon,
                      size: 18,
                    ),
                    if (!compact) ...[
                      const SizedBox(width: 6),
                      Text(item.label),
                    ],
                  ],
                ),
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
