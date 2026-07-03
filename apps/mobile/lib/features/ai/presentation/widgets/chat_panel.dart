import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';
import '../providers/ai_providers.dart';
import '../widgets/ai_selectors.dart';
import '../widgets/chat_message_bubble.dart';
import '../widgets/typing_indicator.dart';

class ChatPanel extends HookConsumerWidget {
  const ChatPanel({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final conversationId = ref.watch(activeConversationIdProvider);
    final chatState = ref.watch(aiChatProvider(conversationId));
    final scrollController = useScrollController();

    useEffect(() {
      if (chatState.messages.isEmpty) {
        return null;
      }
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (scrollController.hasClients) {
          scrollController.animateTo(
            scrollController.position.maxScrollExtent,
            duration: const Duration(milliseconds: 200),
            curve: Curves.easeOut,
          );
        }
      });
      return null;
    }, [chatState.messages.length, chatState.messages.lastOrNull?.displayContent]);

    return ListView.builder(
      controller: scrollController,
      padding: const EdgeInsets.all(AppSpacing.md),
      itemCount: chatState.messages.length,
      itemBuilder: (context, index) {
        final message = chatState.messages[index];
        final isLastAssistant =
            index == chatState.messages.length - 1 && message.isAssistant;

        return ChatMessageBubble(
          message: message,
          showRegenerate: isLastAssistant && !chatState.isStreaming,
          onCopy: () {
            copyMessageToClipboard(message);
            ScaffoldMessenger.of(context).showSnackBar(
              const SnackBar(content: Text('Copied to clipboard')),
            );
          },
          onRegenerate: () =>
              ref.read(aiChatProvider(conversationId).notifier).regenerateLastResponse(),
        );
      },
    );
  }
}

/// Agent configuration side panel (desktop).
class AgentPanel extends ConsumerWidget {
  const AgentPanel({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final agent = ref.watch(selectedAgentProvider);
    final colors = context.voltxColors;

    return Container(
      width: 260,
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        border: Border(left: BorderSide(color: colors.borderSubtle)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Agent', style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: AppSpacing.sm),
          const AgentSelector(),
          const SizedBox(height: AppSpacing.md),
          Text(agent.name, style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(height: AppSpacing.xxs),
          Text(
            agent.description,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.textSecondary),
          ),
        ],
      ),
    );
  }
}

/// Context panel with model, knowledge, and tokens (desktop).
class ContextPanel extends ConsumerWidget {
  const ContextPanel({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final model = ref.watch(selectedModelProvider);
    final conversationId = ref.watch(activeConversationIdProvider);
    final chatState = ref.watch(aiChatProvider(conversationId));
    final colors = context.voltxColors;

    return Container(
      width: 260,
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        border: Border(left: BorderSide(color: colors.borderSubtle)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Context', style: Theme.of(context).textTheme.titleSmall),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              Text('Model', style: Theme.of(context).textTheme.labelMedium),
              const Spacer(),
              const ModelSelector(),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Text('Knowledge', style: Theme.of(context).textTheme.labelMedium),
          const SizedBox(height: AppSpacing.xs),
          const Expanded(child: KnowledgeSelector()),
          const SizedBox(height: AppSpacing.md),
          TokenUsageIndicator(
            tokensUsed: chatState.tokensUsed,
            contextWindow: model.contextWindow,
          ),
        ],
      ),
    );
  }
}
