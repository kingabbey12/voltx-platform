import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../theme/tokens/motion_tokens.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';
import '../providers/dashboard_providers.dart';

/// Right collapsible AI assistant panel for desktop.
class DashboardAiPanel extends ConsumerWidget {
  const DashboardAiPanel({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.voltxColors;
    final scheme = Theme.of(context).colorScheme;
    final messages = ref.watch(aiChatMessagesProvider);

    return AnimatedContainer(
      duration: MotionTokens.normal,
      curve: MotionTokens.standard,
      width: 320,
      decoration: BoxDecoration(
        color: colors.surfaceElevated,
        border: Border(left: BorderSide(color: colors.borderSubtle)),
      ),
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.all(AppSpacing.sm),
              child: Row(
                children: [
                  Icon(Icons.auto_awesome_rounded, color: scheme.primary, size: 20),
                  const SizedBox(width: AppSpacing.xs),
                  Expanded(
                    child: Text(
                      'Voltx AI',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.close_rounded, size: 20),
                    onPressed: () =>
                        ref.read(dashboardShellProvider.notifier).setAiPanelOpen(false),
                  ),
                ],
              ),
            ),
            Divider(height: 1, color: colors.borderSubtle),
            Expanded(
              child: ListView.builder(
                padding: const EdgeInsets.all(AppSpacing.sm),
                itemCount: messages.length,
                itemBuilder: (context, index) {
                  final message = messages[index];
                  return _AiBubble(message: message.content, isUser: message.isUser);
                },
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(AppSpacing.sm),
              child: Text(
                'Open AI Workspace for full chat',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: colors.textTertiary,
                    ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AiBubble extends StatelessWidget {
  const _AiBubble({required this.message, required this.isUser});

  final String message;
  final bool isUser;

  @override
  Widget build(BuildContext context) {
    final colors = context.voltxColors;
    final scheme = Theme.of(context).colorScheme;

    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: AppSpacing.sm),
        padding: const EdgeInsets.all(AppSpacing.sm),
        constraints: const BoxConstraints(maxWidth: 260),
        decoration: BoxDecoration(
          color: isUser
              ? scheme.primary.withValues(alpha: 0.12)
              : colors.surfaceMuted,
          borderRadius: BorderRadius.circular(12),
        ),
        child: Text(
          message,
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ),
    );
  }
}
