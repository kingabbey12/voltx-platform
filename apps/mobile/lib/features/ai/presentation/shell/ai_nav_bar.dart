import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../router/routes.dart';
import '../../../../theme/tokens/spacing.dart';
import '../widgets/ai_workspace_components.dart';

/// AI section sub-navigation bar.
class AiNavBar extends StatelessWidget {
  const AiNavBar({this.compact = false, super.key});

  final bool compact;

  static const _items = [
    _NavItem('Home', AppRoutes.aiHome, Icons.home_outlined, Icons.home_rounded),
    _NavItem('Chat', AppRoutes.aiChat, Icons.chat_outlined, Icons.chat_rounded),
    _NavItem('Agents', AppRoutes.aiAgents, Icons.smart_toy_outlined, Icons.smart_toy_rounded),
    _NavItem('Operator', AppRoutes.aiOperator, Icons.dashboard_outlined, Icons.dashboard_rounded),
    _NavItem('Memory', AppRoutes.aiMemory, Icons.psychology_outlined, Icons.psychology_rounded),
    _NavItem('Knowledge', AppRoutes.aiKnowledge, Icons.menu_book_outlined, Icons.menu_book_rounded),
    _NavItem('Workflows', AppRoutes.aiAutomations, Icons.bolt_outlined, Icons.bolt_rounded),
    _NavItem('Integrations', AppRoutes.aiIntegrations, Icons.hub_outlined, Icons.hub_rounded),
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
    final location = GoRouterState.of(context).uri.toString();

    return SizedBox(
      height: compact ? 56 : 64,
      child: ListView(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
        scrollDirection: Axis.horizontal,
        children: [
          for (final item in _items)
            Padding(
              padding: const EdgeInsets.only(right: AppSpacing.xs),
              child: AiSuggestionChip(
                label: item.label,
                icon: _isSelected(location, item.route) ? item.selectedIcon : item.icon,
                onTap: () => context.go(item.route),
                color: _isSelected(location, item.route)
                    ? Theme.of(context).colorScheme.primary
                    : null,
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
