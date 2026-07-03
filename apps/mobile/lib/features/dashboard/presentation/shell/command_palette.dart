import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';
import '../../data/models/dashboard_models.dart';
import '../providers/dashboard_providers.dart';

/// Command palette overlay (⌘K / Ctrl+K).
void showCommandPalette(BuildContext context, WidgetRef ref) {
  showDialog<void>(
    context: context,
    barrierColor: Colors.black54,
    builder: (dialogContext) => const CommandPaletteDialog(),
  ).whenComplete(() {
    ref.read(commandPaletteOpenProvider.notifier).state = false;
    ref.read(commandPaletteQueryProvider.notifier).state = '';
  });
}

class CommandPaletteDialog extends ConsumerStatefulWidget {
  const CommandPaletteDialog({super.key});

  @override
  ConsumerState<CommandPaletteDialog> createState() => _CommandPaletteDialogState();
}

class _CommandPaletteDialogState extends ConsumerState<CommandPaletteDialog> {
  late final TextEditingController _controller;
  late final FocusNode _focusNode;

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController();
    _focusNode = FocusNode();
    WidgetsBinding.instance.addPostFrameCallback((_) => _focusNode.requestFocus());
  }

  @override
  void dispose() {
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _execute(CommandPaletteItem item) {
    Navigator.of(context).pop();
    switch (item.route) {
      case '__toggle_ai__':
        ref.read(dashboardShellProvider.notifier).toggleAiPanel();
      case '__toggle_sidebar__':
        ref.read(dashboardShellProvider.notifier).toggleSidebar();
      default:
        context.go(item.route);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.voltxColors;
    final results = ref.watch(commandPaletteResultsProvider);

    return Center(
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 560),
        child: Material(
          color: colors.surfaceElevated,
          borderRadius: BorderRadius.circular(16),
          clipBehavior: Clip.antiAlias,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Padding(
                padding: const EdgeInsets.all(AppSpacing.sm),
                child: TextField(
                  controller: _controller,
                  focusNode: _focusNode,
                  decoration: InputDecoration(
                    hintText: 'Type a command or search…',
                    prefixIcon: const Icon(Icons.search_rounded),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: BorderSide(color: colors.borderSubtle),
                    ),
                  ),
                  onChanged: (value) =>
                      ref.read(commandPaletteQueryProvider.notifier).state = value,
                  onSubmitted: (_) {
                    if (results.isNotEmpty) {
                      _execute(results.first);
                    }
                  },
                ),
              ),
              Divider(height: 1, color: colors.borderSubtle),
              ConstrainedBox(
                constraints: const BoxConstraints(maxHeight: 320),
                child: ListView.builder(
                  shrinkWrap: true,
                  itemCount: results.length,
                  itemBuilder: (context, index) {
                    final item = results[index];
                    return ListTile(
                      leading: Icon(dashboardIcon(item.iconName)),
                      title: Text(item.label),
                      subtitle: Text(item.subtitle),
                      onTap: () => _execute(item),
                    );
                  },
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
