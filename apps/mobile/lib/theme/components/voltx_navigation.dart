import 'package:flutter/material.dart';

import '../tokens/icon_tokens.dart';
import '../voltx_theme.dart';

class VoltxNavigationDestination {
  const VoltxNavigationDestination({
    required this.icon,
    required this.selectedIcon,
    required this.label,
  });

  final IconData icon;
  final IconData selectedIcon;
  final String label;
}

/// Bottom navigation styled for Apple clarity and Linear minimal chrome.
class VoltxNavigationBar extends StatelessWidget {
  const VoltxNavigationBar({
    required this.selectedIndex,
    required this.destinations,
    required this.onDestinationSelected,
    super.key,
  });

  final int selectedIndex;
  final List<VoltxNavigationDestination> destinations;
  final ValueChanged<int> onDestinationSelected;

  @override
  Widget build(BuildContext context) {
    final colors = context.voltxColors;
    final scheme = Theme.of(context).colorScheme;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.surfaceElevated,
        border: Border(top: BorderSide(color: colors.borderSubtle)),
      ),
      child: SafeArea(
        top: false,
        child: NavigationBar(
          height: 64,
          elevation: 0,
          backgroundColor: Colors.transparent,
          indicatorColor: scheme.primary.withValues(alpha: 0.12),
          labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
          selectedIndex: selectedIndex,
          onDestinationSelected: onDestinationSelected,
          destinations: [
            for (final destination in destinations)
              NavigationDestination(
                icon: Icon(destination.icon, size: IconTokens.navigation),
                selectedIcon: Icon(
                  destination.selectedIcon,
                  size: IconTokens.navigation,
                ),
                label: destination.label,
              ),
          ],
        ),
      ),
    );
  }
}

/// Top app bar aligned with Voltx navigation tokens.
class VoltxAppBar extends StatelessWidget implements PreferredSizeWidget {
  const VoltxAppBar({
    required this.title,
    this.actions,
    this.leading,
    this.centerTitle = false,
    super.key,
  });

  final String title;
  final List<Widget>? actions;
  final Widget? leading;
  final bool centerTitle;

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context) {
    final colors = context.voltxColors;

    return AppBar(
      title: Text(title),
      centerTitle: centerTitle,
      leading: leading,
      actions: actions,
      elevation: 0,
      scrolledUnderElevation: 0,
      backgroundColor: colors.surfaceElevated,
      foregroundColor: colors.textPrimary,
      surfaceTintColor: Colors.transparent,
      bottom: PreferredSize(
        preferredSize: const Size.fromHeight(1),
        child: Divider(height: 1, color: colors.borderSubtle),
      ),
    );
  }
}

/// Segmented control wrapper for settings and filters.
class VoltxSegmentedControl<T extends Object> extends StatelessWidget {
  const VoltxSegmentedControl({
    required this.segments,
    required this.selected,
    required this.onSelectionChanged,
    super.key,
  });

  final Map<T, Widget> segments;
  final Set<T> selected;
  final ValueChanged<Set<T>> onSelectionChanged;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: SegmentedButton<T>(
        segments: [
          for (final entry in segments.entries)
            ButtonSegment<T>(
              value: entry.key,
              label: entry.value,
            ),
        ],
        selected: selected,
        onSelectionChanged: onSelectionChanged,
        showSelectedIcon: false,
      ),
    );
  }
}
