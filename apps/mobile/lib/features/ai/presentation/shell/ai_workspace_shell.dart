import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../router/routes.dart';
import '../../../../shared/widgets/responsive_layout.dart';
import '../../../../theme/components/voltx_motion.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';
import '../providers/ai_providers.dart';
import '../widgets/chat_panel.dart';
import '../widgets/conversation_list.dart';
import '../widgets/prompt_editor.dart';
import '../widgets/tool_execution_panel.dart';
import '../widgets/ai_workspace_components.dart';
import 'ai_context_sheet.dart';
import 'ai_nav_bar.dart';

/// Responsive AI workspace shell for chat layout.
class AiWorkspaceShell extends ConsumerWidget {
  const AiWorkspaceShell({required this.child, super.key});

  final Widget child;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isMobile = currentBreakpoint(context) == AppBreakpoint.compact;
    final colors = context.voltxColors;

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            Theme.of(context).scaffoldBackgroundColor,
            colors.surfaceMuted.withValues(alpha: 0.4),
            Theme.of(context).scaffoldBackgroundColor,
          ],
        ),
      ),
      child: Column(
        children: [
          AiNavBar(compact: isMobile),
          Expanded(child: child),
        ],
      ),
    );
  }
}

/// Desktop/mobile chat layout with all panels.
class AiChatLayout extends HookConsumerWidget {
  const AiChatLayout({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isMobile = currentBreakpoint(context) == AppBreakpoint.compact;
    final shellLayout = ref.watch(aiShellLayoutProvider);
    final conversationId = ref.watch(activeConversationIdProvider);
    final chatState = ref.watch(aiChatProvider(conversationId));
    final historyWidth = useState(292.0);
    final contextWidth = useState(312.0);
    final agentWidth = useState(304.0);

    if (isMobile) {
      return Column(
        children: [
          const Expanded(child: ChatPanel()),
          if (chatState.activeTool != null)
            ToolExecutionPanel(execution: chatState.activeTool!),
          PromptEditor(
            isStreaming: chatState.isStreaming,
            onSend: (text) =>
                ref.read(aiChatProvider(conversationId).notifier).sendMessage(text),
            onStop: () =>
                ref.read(aiChatProvider(conversationId).notifier).stopGeneration(),
          ),
          VoltxSlideIn(
            begin: const Offset(0, 0.06),
            child: _MobileBottomActions(
              onContext: () => showAiContextSheet(context),
              onHistory: () => context.push(AppRoutes.aiHistory),
              onKnowledge: () => context.push(AppRoutes.aiKnowledge),
              onAgents: () => context.push(AppRoutes.aiAgents),
            ),
          ),
        ],
      );
    }

    return Row(
      children: [
        if (shellLayout.showHistoryPanel)
          VoltxSlideIn(
            begin: const Offset(-0.02, 0),
            child: VoltxSidebarCollapse(
              collapsed: false,
              expandedWidth: historyWidth.value,
              collapsedWidth: 0,
              child: AiSidebar(
                width: historyWidth.value,
                title: 'Conversation Sidebar',
                trailing: IconButton(
                  icon: const Icon(Icons.view_sidebar_rounded, size: 16),
                  onPressed: () => ref.read(aiShellLayoutProvider.notifier).toggleHistoryPanel(),
                ),
                child: ConversationList(
                  onSelect: (id) => ref.read(activeConversationIdProvider.notifier).state = id,
                ),
              ),
            ),
          ),
        if (shellLayout.showHistoryPanel)
          _PanelResizeHandle(
            onDrag: (delta) => historyWidth.value = (historyWidth.value + delta).clamp(240.0, 420.0),
          ),
        Expanded(
          child: Column(
            children: [
              const Expanded(child: ChatPanel()),
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
        if (shellLayout.showContextPanel)
          _PanelResizeHandle(
            onDrag: (delta) => contextWidth.value = (contextWidth.value - delta).clamp(260.0, 420.0),
          ),
        if (shellLayout.showContextPanel)
          VoltxSidebarCollapse(
            collapsed: false,
            expandedWidth: contextWidth.value,
            collapsedWidth: 0,
            child: SizedBox(
              width: contextWidth.value,
              child: const ContextPanel(),
            ),
          ),
        if (shellLayout.showAgentPanel)
          _PanelResizeHandle(
            onDrag: (delta) => agentWidth.value = (agentWidth.value - delta).clamp(240.0, 420.0),
          ),
        if (shellLayout.showAgentPanel)
          VoltxSidebarCollapse(
            collapsed: false,
            expandedWidth: agentWidth.value,
            collapsedWidth: 0,
            child: SizedBox(
              width: agentWidth.value,
              child: const AgentPanel(),
            ),
          ),
      ],
    );
  }
}

class _PanelResizeHandle extends StatelessWidget {
  const _PanelResizeHandle({required this.onDrag});

  final ValueChanged<double> onDrag;

  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      cursor: SystemMouseCursors.resizeColumn,
      child: GestureDetector(
        behavior: HitTestBehavior.translucent,
        onHorizontalDragUpdate: (details) => onDrag(details.delta.dx),
        child: const SizedBox(
          width: 8,
          child: Center(
            child: SizedBox(
              width: 2,
              height: 44,
              child: DecoratedBox(
                decoration: BoxDecoration(color: Color(0x22000000)),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _MobileBottomActions extends StatelessWidget {
  const _MobileBottomActions({
    required this.onContext,
    required this.onHistory,
    required this.onKnowledge,
    required this.onAgents,
  });

  final VoidCallback onContext;
  final VoidCallback onHistory;
  final VoidCallback onKnowledge;
  final VoidCallback onAgents;

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
          TextButton.icon(
            onPressed: onKnowledge,
            icon: const Icon(Icons.menu_book_outlined, size: 18),
            label: const Text('Knowledge'),
          ),
          TextButton.icon(
            onPressed: onAgents,
            icon: const Icon(Icons.smart_toy_outlined, size: 18),
            label: const Text('Agents'),
          ),
        ],
      ),
    );
  }
}
