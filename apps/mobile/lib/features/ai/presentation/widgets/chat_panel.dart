import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../theme/tokens/spacing.dart';
import '../providers/ai_providers.dart';
import '../widgets/ai_selectors.dart';
import '../widgets/ai_workspace_components.dart';
import '../widgets/chat_message_bubble.dart';
import '../widgets/suggested_prompts.dart';
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

    return AiPanel(
      fillChild: true,
      header: Row(
        children: [
          Text(
            'Chat Workspace',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(width: AppSpacing.xs),
          AiSuggestionChip(
            label: chatState.isStreaming ? 'Streaming' : 'Ready',
            icon: chatState.isStreaming ? Icons.stream_rounded : Icons.check_circle_rounded,
          ),
          const SizedBox(width: AppSpacing.xs),
          AiSuggestionChip(
            label: '${chatState.messages.length} msgs',
            icon: Icons.chat_bubble_outline_rounded,
          ),
          const Spacer(),
          AiSuggestionChip(
            label: chatState.activeTool == null ? 'Tools idle' : 'Tool running',
            icon: chatState.activeTool == null ? Icons.handyman_outlined : Icons.precision_manufacturing_rounded,
          ),
        ],
      ),
      child: chatState.messages.isEmpty
          ? Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const AiEmptyState(
                  title: 'Start an AI conversation',
                  subtitle: 'Use a suggested prompt to launch reasoning with tools, context, and memory.',
                  icon: Icons.auto_awesome_rounded,
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  'Suggested prompts',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: AppSpacing.sm),
                SuggestedPrompts(
                  onSelect: (prompt) =>
                      ref.read(aiChatProvider(conversationId).notifier).sendMessage(prompt),
                ),
                const SizedBox(height: AppSpacing.md),
                const AiLoadingState(lines: 2),
              ],
            )
          : ListView.builder(
              controller: scrollController,
              padding: EdgeInsets.zero,
              itemCount: chatState.messages.length + (chatState.isStreaming ? 1 : 0),
              itemBuilder: (context, index) {
                if (index == chatState.messages.length && chatState.isStreaming) {
                  return const Padding(
                    padding: EdgeInsets.only(bottom: AppSpacing.sm),
                    child: Align(
                      alignment: Alignment.centerLeft,
                      child: TypingIndicator(),
                    ),
                  );
                }

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
                  onRegenerate: () => ref
                      .read(aiChatProvider(conversationId).notifier)
                      .regenerateLastResponse(),
                );
              },
            ),
    );
  }
}

/// Agent configuration side panel (desktop).
class AgentPanel extends ConsumerWidget {
  const AgentPanel({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final agent = ref.watch(selectedAgentProvider);
    final agents = ref.watch(agentsProvider);
    final conversationId = ref.watch(activeConversationIdProvider);
    final chatState = ref.watch(aiChatProvider(conversationId));

    return SizedBox(
      width: 292,
      child: ListView(
        padding: EdgeInsets.zero,
        children: [
          AiPanel(
            header: Row(
              children: [
                Text(
                  'Tool Status',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                ),
                const Spacer(),
                AiSuggestionChip(
                  label: chatState.activeTool == null ? 'Idle' : 'Running',
                  icon: chatState.activeTool == null ? Icons.pause_circle_outline : Icons.sync_rounded,
                ),
              ],
            ),
            child: chatState.activeTool == null
                ? const AiEmptyState(
                    title: 'No active tool execution',
                    subtitle: 'Tools will appear here while the assistant reasons through your request.',
                    icon: Icons.handyman_outlined,
                  )
                : AiToolExecutionCard(execution: chatState.activeTool!),
          ),
          const SizedBox(height: AppSpacing.sm),
          AiPanel(
            header: Row(
              children: [
                Text(
                  'Active Agent',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                ),
                const Spacer(),
                const AiSuggestionChip(label: 'Online', icon: Icons.circle),
              ],
            ),
            child: AiAgentCard(
              agent: agent,
              selected: true,
              status: 'Active',
              memoryUsage: '68%',
              toolCount: 7,
              recentActivity: 'Last action: generated opportunity summary 2m ago',
              onTap: () {},
              onRun: () {},
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          AiPanel(
            header: Text(
              'Available Agents',
              style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
            ),
            child: Column(
              children: [
                const AgentSelector(),
                const SizedBox(height: AppSpacing.sm),
                for (final item in agents)
                  Padding(
                    padding: const EdgeInsets.only(bottom: AppSpacing.xs),
                    child: AiAgentCard(
                      agent: item,
                      selected: item.id == agent.id,
                      onTap: () => ref.read(selectedAgentProvider.notifier).state = item,
                      status: item.id == agent.id ? 'Active' : 'Idle',
                      memoryUsage: item.id == agent.id ? '68%' : '42%',
                      toolCount: item.id == agent.id ? 7 : 5,
                      recentActivity: 'Recent activity available',
                    ),
                  ),
              ],
            ),
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
    final knowledge = ref.watch(selectedKnowledgeProvider);
    final bases = ref.watch(knowledgeBasesProvider);

    final timeline = <AiTimelineItem>[
      for (final message in chatState.messages.take(5))
        AiTimelineItem(
          title: message.isUser ? 'User prompt' : 'Assistant reasoning',
          subtitle: message.displayContent.isEmpty
              ? 'Streaming response...'
              : message.displayContent.split('\n').first,
          time: _formatTime(message.timestamp),
          color: message.isUser ? Theme.of(context).colorScheme.secondary : Theme.of(context).colorScheme.primary,
        ),
      if (chatState.isStreaming)
        const AiTimelineItem(
          title: 'Streaming',
          subtitle: 'Response generation in progress',
          time: 'Now',
        ),
    ];

    return SizedBox(
      width: 308,
      child: ListView(
        padding: EdgeInsets.zero,
        children: [
          AiPanel(
            header: Row(
              children: [
                Text(
                  'Context Drawer',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                ),
                const Spacer(),
                const AiSuggestionChip(label: 'Live', icon: Icons.track_changes_rounded),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text('Model', style: Theme.of(context).textTheme.labelMedium),
                    const Spacer(),
                    const ModelSelector(),
                  ],
                ),
                const SizedBox(height: AppSpacing.sm),
                AiContextCard(label: 'Provider', value: 'Voltx AI Runtime'),
                const SizedBox(height: AppSpacing.xs),
                AiContextCard(label: 'Workspace', value: 'Executive Operations'),
                const SizedBox(height: AppSpacing.xs),
                AiContextCard(label: 'Knowledge', value: knowledge.name),
                const SizedBox(height: AppSpacing.xs),
                TokenUsageIndicator(
                  tokensUsed: chatState.tokensUsed,
                  contextWindow: model.contextWindow,
                ),
                const SizedBox(height: AppSpacing.xs),
                AiContextCard(
                  label: 'Tool status',
                  value: chatState.activeTool == null
                      ? 'Idle'
                      : '${chatState.activeTool!.toolName} (${chatState.activeTool!.status.name})',
                ),
                const SizedBox(height: AppSpacing.sm),
                const Text('Connected Knowledge'),
                const SizedBox(height: AppSpacing.xs),
                const KnowledgeSelector(),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          AiPanel(
            header: Text(
              'Knowledge Panel',
              style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
            ),
            child: Column(
              children: [
                for (final kb in bases)
                  Padding(
                    padding: const EdgeInsets.only(bottom: AppSpacing.xs),
                    child: AiKnowledgeCard(
                      title: kb.name,
                      description: kb.description,
                      documents: kb.documentCount,
                      category: kb.id == knowledge.id ? 'Active' : 'Linked',
                      lastSynced: _relativeTime(kb.lastSynced),
                      selected: kb.id == knowledge.id,
                      onTap: () => ref.read(selectedKnowledgeProvider.notifier).state = kb,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          const AiMemoryCard(
            title: 'Workspace Memory',
            summary: 'Persistent cues currently influencing generation.',
            items: [
              'North Region load volatility in morning windows',
              'Executive preference: concise action-first summaries',
              'Priority program: Helios expansion rollout',
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          AiPanel(
            header: Text(
              'Reasoning Timeline',
              style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
            ),
            child: timeline.isEmpty
                ? const AiEmptyState(
                    title: 'No reasoning events yet',
                    subtitle: 'Timeline entries appear as conversation reasoning advances.',
                    icon: Icons.timeline_rounded,
                  )
                : AiTimeline(items: timeline),
          ),
        ],
      ),
    );
  }

  String _relativeTime(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 60) {
      return '${diff.inMinutes}m ago';
    }
    if (diff.inHours < 24) {
      return '${diff.inHours}h ago';
    }
    return '${diff.inDays}d ago';
  }

  String _formatTime(DateTime dt) {
    final h = dt.hour % 12 == 0 ? 12 : dt.hour % 12;
    final m = dt.minute.toString().padLeft(2, '0');
    final suffix = dt.hour >= 12 ? 'PM' : 'AM';
    return '$h:$m $suffix';
  }
}
