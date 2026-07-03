import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../router/routes.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';
import '../providers/dashboard_providers.dart';
import 'command_palette.dart';

/// Top command bar with search trigger, notifications, and profile.
class DashboardCommandBar extends ConsumerWidget {
  const DashboardCommandBar({this.compact = false, super.key});

  final bool compact;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.voltxColors;
    final unread = ref.watch(unreadNotificationsCountProvider);

    return Container(
      height: 56,
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
      decoration: BoxDecoration(
        color: colors.surfaceElevated,
        border: Border(bottom: BorderSide(color: colors.borderSubtle)),
      ),
      child: Row(
        children: [
          if (compact)
            Builder(
              builder: (context) => IconButton(
                icon: const Icon(Icons.menu_rounded),
                onPressed: () => Scaffold.of(context).openDrawer(),
              ),
            ),
          Expanded(
            child: _CommandSearchTrigger(
              onTap: () => _openCommandPalette(context, ref),
            ),
          ),
          IconButton(
            icon: Badge(
              isLabelVisible: unread > 0,
              label: Text('$unread'),
              child: const Icon(Icons.notifications_outlined),
            ),
            tooltip: 'Notifications',
            onPressed: () => context.go(AppRoutes.dashboardNotifications),
          ),
          IconButton(
            icon: const Icon(Icons.person_outline_rounded),
            tooltip: 'Profile',
            onPressed: () => context.go(AppRoutes.dashboardProfile),
          ),
        ],
      ),
    );
  }

  void _openCommandPalette(BuildContext context, WidgetRef ref) {
    ref.read(commandPaletteOpenProvider.notifier).state = true;
    ref.read(commandPaletteQueryProvider.notifier).state = '';
    showCommandPalette(context, ref);
  }
}

class _CommandSearchTrigger extends StatelessWidget {
  const _CommandSearchTrigger({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.voltxColors;
    final isMac = Theme.of(context).platform == TargetPlatform.macOS;

    return Material(
      color: colors.surfaceMuted,
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: 10),
          child: Row(
            children: [
              Icon(Icons.search_rounded, size: 20, color: colors.textTertiary),
              const SizedBox(width: AppSpacing.xs),
              Expanded(
                child: Text(
                  'Search or jump to…',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: colors.textTertiary,
                      ),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: colors.surfaceElevated,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: colors.borderSubtle),
                ),
                child: Text(
                  isMac ? '⌘K' : 'Ctrl+K',
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: colors.textSecondary,
                      ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Keyboard shortcut intent for command palette.
class OpenCommandPaletteIntent extends Intent {
  const OpenCommandPaletteIntent();
}

/// Wraps dashboard content with keyboard shortcuts.
class DashboardShortcuts extends ConsumerWidget {
  const DashboardShortcuts({required this.child, super.key});

  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Shortcuts(
      shortcuts: const {
        SingleActivator(LogicalKeyboardKey.keyK, meta: true): OpenCommandPaletteIntent(),
        SingleActivator(LogicalKeyboardKey.keyK, control: true): OpenCommandPaletteIntent(),
      },
      child: Actions(
        actions: {
          OpenCommandPaletteIntent: CallbackAction<OpenCommandPaletteIntent>(
            onInvoke: (_) {
              ref.read(commandPaletteOpenProvider.notifier).state = true;
              ref.read(commandPaletteQueryProvider.notifier).state = '';
              showCommandPalette(context, ref);
              return null;
            },
          ),
        },
        child: Focus(autofocus: true, child: child),
      ),
    );
  }
}
