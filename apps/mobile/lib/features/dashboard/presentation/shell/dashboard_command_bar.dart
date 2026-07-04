import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../router/routes.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';
import '../../../../theme/components/voltx_motion.dart';
import '../providers/dashboard_providers.dart';
import 'command_palette.dart';

/// Top command bar with search trigger, notifications, and profile.
class DashboardCommandBar extends ConsumerWidget {
  const DashboardCommandBar({this.compact = false, super.key});

  final bool compact;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.voltxColors;
    final radii = context.voltxRadii;
    final unread = ref.watch(unreadNotificationsCountProvider);
    return LayoutBuilder(
      builder: (context, constraints) {
        final maxWidth = constraints.maxWidth;
        final ultraTiny = maxWidth < 240;
        final tiny = maxWidth < 360;
        final narrow = maxWidth < 560;
        final compactActions = compact || narrow;

        return Container(
          height: AppSpacing.commandBarHeight,
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                colors.surfaceElevated.withValues(alpha: 0.96),
                colors.surfaceMuted.withValues(alpha: 0.76),
              ],
            ),
            border: Border(bottom: BorderSide(color: colors.borderSubtle.withValues(alpha: 0.92))),
          ),
          child: Row(
            children: [
              if (compact)
                Builder(
                  builder: (context) => IconButton(
                    icon: const Icon(Icons.menu_rounded),
                    visualDensity: VisualDensity.compact,
                    onPressed: () => Scaffold.of(context).openDrawer(),
                  ),
                ),
              if (!compact && !narrow) ...[
                _WorkspaceSwitcher(onSelected: (_) {}),
                const SizedBox(width: AppSpacing.sm),
              ],
              Expanded(
                child: VoltxPressable(
                  borderRadius: radii.mdBorder,
                  onTap: () => _openCommandPalette(context, ref),
                  child: _CommandSearchTrigger(
                    onTap: () => _openCommandPalette(context, ref),
                  ),
                ),
              ),
              if (!ultraTiny && !tiny) const SizedBox(width: AppSpacing.xs),
              if (!compactActions)
                const _ShortcutChip(label: '⌘K', icon: Icons.keyboard_command_key_rounded),
              if (!compactActions) const SizedBox(width: AppSpacing.xs),
              if (!compactActions) ...[
                const _AiStatusChip(),
                const SizedBox(width: AppSpacing.xs),
              ],
              if (!compactActions && !ultraTiny)
                IconButton(
                  tooltip: 'Quick actions',
                  onPressed: () => _openCommandPalette(context, ref),
                  visualDensity: VisualDensity.compact,
                  icon: const Icon(Icons.flash_on_rounded),
                ),
              if (!tiny && !ultraTiny)
                IconButton(
                  icon: Badge(
                    isLabelVisible: unread > 0,
                    label: Text(unread > 99 ? '99+' : '$unread'),
                    child: const Icon(Icons.notifications_outlined),
                  ),
                  tooltip: 'Notifications',
                  visualDensity: VisualDensity.compact,
                  onPressed: () => context.go(AppRoutes.dashboardNotifications),
                ),
              if (!narrow && !ultraTiny)
                _ProfileButton(onPressed: () => context.go(AppRoutes.dashboardProfile)),
            ],
          ),
        );
      },
    );
  }

  void _openCommandPalette(BuildContext context, WidgetRef ref) {
    ref.read(commandPaletteOpenProvider.notifier).state = true;
    ref.read(commandPaletteQueryProvider.notifier).state = '';
    showCommandPalette(context, ref);
  }
}

class _WorkspaceSwitcher extends StatelessWidget {
  const _WorkspaceSwitcher({required this.onSelected});

  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    final colors = context.voltxColors;
    final scheme = Theme.of(context).colorScheme;

    return PopupMenuButton<String>(
      tooltip: 'Switch workspace',
      onSelected: onSelected,
      itemBuilder: (context) => const [
        PopupMenuItem(value: 'executive', child: Text('Executive Ops')),
        PopupMenuItem(value: 'sales', child: Text('Sales Command')),
        PopupMenuItem(value: 'ai', child: Text('AI Workspace')),
      ],
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: AppSpacing.xs),
        decoration: BoxDecoration(
          color: colors.surfaceMuted.withValues(alpha: 0.7),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: colors.borderSubtle),
        ),
        child: Row(
          children: [
            Icon(Icons.workspaces_outline, size: 16, color: scheme.primary),
            const SizedBox(width: AppSpacing.xxs),
            Text(
              'Executive Ops',
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: colors.textPrimary,
                    fontWeight: FontWeight.w700,
                  ),
            ),
            const SizedBox(width: AppSpacing.xxs),
            Icon(Icons.expand_more_rounded, size: 16, color: colors.textSecondary),
          ],
        ),
      ),
    );
  }
}

class _AiStatusChip extends StatelessWidget {
  const _AiStatusChip();

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs, vertical: AppSpacing.xxs),
      decoration: BoxDecoration(
        color: scheme.primary.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: scheme.primary.withValues(alpha: 0.26)),
      ),
      child: Row(
        children: [
          Icon(Icons.auto_awesome_rounded, size: 14, color: scheme.primary),
          const SizedBox(width: AppSpacing.xxs),
          Text(
            'AI Online',
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: scheme.primary,
                  fontWeight: FontWeight.w700,
                ),
          ),
        ],
      ),
    );
  }
}

class _ShortcutChip extends StatelessWidget {
  const _ShortcutChip({required this.label, required this.icon});

  final String label;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final colors = context.voltxColors;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs, vertical: AppSpacing.xxs),
      decoration: BoxDecoration(
        color: colors.surfaceMuted.withValues(alpha: 0.66),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: colors.borderSubtle),
      ),
      child: Row(
        children: [
          Icon(icon, size: 14, color: colors.textTertiary),
          const SizedBox(width: AppSpacing.xxs),
          Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: colors.textSecondary,
                  fontWeight: FontWeight.w700,
                ),
          ),
        ],
      ),
    );
  }
}

class _ProfileButton extends StatelessWidget {
  const _ProfileButton({required this.onPressed});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final colors = context.voltxColors;
    final scheme = Theme.of(context).colorScheme;

    return VoltxPressable(
      borderRadius: BorderRadius.circular(10),
      onTap: onPressed,
      child: Container(
        width: 34,
        height: 34,
        decoration: BoxDecoration(
          color: colors.surfaceMuted.withValues(alpha: 0.8),
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: colors.borderSubtle),
        ),
        child: Icon(Icons.person_outline_rounded, size: 18, color: scheme.primary),
      ),
    );
  }
}

class _CommandSearchTrigger extends StatelessWidget {
  const _CommandSearchTrigger({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.voltxColors;
    final isMac = Theme.of(context).platform == TargetPlatform.macOS;

    return LayoutBuilder(
      builder: (context, constraints) {
        final narrow = constraints.maxWidth < 260;

        return Material(
          color: colors.surfaceMuted.withValues(alpha: 0.66),
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
                      narrow ? 'Search…' : 'Search or jump to…',
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: colors.textTertiary,
                          ),
                    ),
                  ),
                  if (!narrow)
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
      },
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
