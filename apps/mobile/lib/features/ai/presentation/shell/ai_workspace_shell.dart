import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../router/routes.dart';
import '../../../../shared/widgets/responsive_layout.dart';
import '../../../../theme/tokens/motion_tokens.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';
import '../providers/ai_providers.dart';
import '../widgets/chat_panel.dart';
import '../widgets/conversation_list.dart';
import '../widgets/prompt_editor.dart';
import '../widgets/tool_execution_panel.dart';
import 'ai_context_sheet.dart';
import 'ai_nav_bar.dart';

/// Responsive AI workspace shell for chat layout.
class AiWorkspaceShell extends ConsumerWidget {
  const AiWorkspaceShell({required this.child, super.key});

  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isMobile = currentBreakpoint(context) == AppBreakpoint.compact;

    if (isMobile) {
      return Column(
        children: [
          const AiNavBar(compact: true),
          Expanded(child: child),
        ],
      );
    }

    return Column(
      children: [
        const AiNavBar(compact: false),
        Expanded(child: child),
      ],
    );
  }
}

/// Desktop/mobile chat layout with all panels.
class AiChatLayout extends ConsumerWidget {
  const AiChatLayout({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isMobile = currentBreakpoint(context) == AppBreakpoint.compact;
    final shellLayout = ref.watch(aiShellLayoutProvider);
    final conversationId = ref.watch(activeConversationIdProvider);
    final chatState = ref.watch(aiChatProvider(conversationId));
    final colors = context.voltxColors;

    if (isMobile) {
      return Column(
        children: [
          Expanded(child: const ChatPanel()),
          if (chatState.activeTool != null)
            ToolExecutionPanel(execution: chatState.activeTool!),
          PromptEditor(
            isStreaming: chatState.isStreaming,
            onSend: (text) =>
                ref.read(aiChatProvider(conversationId).notifier).sendMessage(text),
            onStop: () =>
                ref.read(aiChatProvider(conversationId).notifier).stopGeneration(),
          ),
          _MobileBottomActions(
            onContext: () => showAiContextSheet(context),
            onHistory: () => context.push(AppRoutes.aiHistory),
          ),
        ],
      );
    }

    return Row(
      children: [
        if (shellLayout.showHistoryPanel)
          AnimatedContainer(
            duration: MotionTokens.normal,
            width: 240,
            decoration: BoxDecoration(
              border: Border(right: BorderSide(color: colors.borderSubtle)),
            ),
            padding: const EdgeInsets.all(AppSpacing.sm),
            child: ConversationList(
              onSelect: (id) =>
                  ref.read(activeConversationIdProvider.notifier).state = id,
            ),
          ),
        Expanded(
          child: Column(
            children: [
              Expanded(child: const ChatPanel()),
              if (chatState.activeTool != null)
                ToolExecutionPanel(execution: chatState.activeTool!),
              PromptEditor(
                isStreaming: chatState.isStreaming,
                onSend: (text) => ref
                    .read(aiChatProvider(conversationId).notifier)
                    .sendMessage(text),
                onStop: () => ref
                    .read(aiChatProvider(conversationId).notifier)
                    .stopGeneration(),
              ),
            ],
          ),
        ),
        if (shellLayout.showAgentPanel) const AgentPanel(),
        if (shellLayout.showContextPanel) const ContextPanel(),
      ],
    );
  }
}

class _MobileBottomActions extends StatelessWidget {
  const _MobileBottomActions({
    required this.onContext,
    required this.onHistory,
  });

  final VoidCallback onContext;
  final VoidCallback onHistory;

  @override
  Widget build(BuildContext context) {
    final colors = context.voltxColors;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: AppSpacing.xs),
      decoration: BoxDecoration(
        color: colors.surfaceElevated,
        border: Border(top: BorderSide(color: colors.borderSubtle)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
        children: [
          TextButton.icon(
            onPressed: onContext,
            icon: const Icon(Icons.tune_rounded, size: 18),
            label: const Text('Context'),
          ),
          TextButton.icon(
            onPressed: onHistory,
            icon: const Icon(Icons.history_rounded, size: 18),
            label: const Text('History'),
          ),
        ],
      ),
    );
  }
}
