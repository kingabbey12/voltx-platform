import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../theme/components/voltx_motion.dart';
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

    return Container(
      width: AppSpacing.sidePanelWidth,
      decoration: BoxDecoration(
        color: colors.surfaceElevated.withValues(alpha: 0.96),
        border: Border(left: BorderSide(color: colors.borderSubtle.withValues(alpha: 0.92))),
      ),
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Container(
              padding: const EdgeInsets.all(AppSpacing.sm),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    scheme.primary.withValues(alpha: 0.16),
                    colors.surfaceMuted.withValues(alpha: 0.82),
                  ],
                ),
              ),
              child: Row(
                children: [
                  Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      color: scheme.primary.withValues(alpha: 0.16),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(Icons.auto_awesome_rounded, color: scheme.primary, size: 16),
                  ),
                  const SizedBox(width: AppSpacing.xs),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Voltx AI',
                          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                                fontWeight: FontWeight.w700,
                              ),
                        ),
                        Text(
                          'Reasoning Engine Online',
                          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                color: colors.textSecondary,
                              ),
                        ),
                      ],
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
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: AppSpacing.xs),
              child: Wrap(
                spacing: AppSpacing.xs,
                runSpacing: AppSpacing.xxs,
                children: const [
                  _PanelChip(label: 'Context Synced', icon: Icons.memory_rounded),
                  _PanelChip(label: 'Confidence 92%', icon: Icons.verified_rounded),
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
                  return VoltxFadeIn(
                    delay: Duration(milliseconds: index * 35),
                    child: _AiBubble(message: message.content, isUser: message.isUser),
                  );
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

class _PanelChip extends StatelessWidget {
  const _PanelChip({required this.label, required this.icon});

  final String label;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final colors = context.voltxColors;
    final scheme = Theme.of(context).colorScheme;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs, vertical: AppSpacing.xxs),
      decoration: BoxDecoration(
        color: scheme.primary.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: scheme.primary.withValues(alpha: 0.26)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: scheme.primary),
          const SizedBox(width: AppSpacing.xxs),
          Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: colors.textPrimary,
                  fontWeight: FontWeight.w700,
                ),
          ),
        ],
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
        constraints: const BoxConstraints(maxWidth: 270),
        decoration: BoxDecoration(
          gradient: isUser
              ? null
              : LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    scheme.primary.withValues(alpha: 0.13),
                    colors.surfaceMuted,
                  ],
                ),
          color: isUser ? scheme.primary.withValues(alpha: 0.16) : null,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: isUser ? scheme.primary.withValues(alpha: 0.3) : colors.borderSubtle,
          ),
        ),
        child: Text(
          message,
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ),
    );
  }
}
