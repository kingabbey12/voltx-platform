import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../theme/tokens/spacing.dart';
import '../providers/ai_providers.dart';
import '../widgets/ai_selectors.dart';
import '../widgets/typing_indicator.dart';
import '../widgets/ai_workspace_components.dart';

/// Slide-up context sheet for mobile (agent, model, knowledge).
void showAiContextSheet(BuildContext context) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (context) => const AiContextSheet(),
  );
}

class AiContextSheet extends ConsumerWidget {
  const AiContextSheet({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final model = ref.watch(selectedModelProvider);
    final agent = ref.watch(selectedAgentProvider);
    final knowledge = ref.watch(selectedKnowledgeProvider);
    final bases = ref.watch(knowledgeBasesProvider);
    final conversationId = ref.watch(activeConversationIdProvider);
    final chatState = ref.watch(aiChatProvider(conversationId));

    final timeline = <AiTimelineItem>[
      for (final message in chatState.messages.take(4))
        AiTimelineItem(
          title: message.isUser ? 'User prompt' : 'Assistant reasoning',
          subtitle: message.displayContent.isEmpty
              ? 'Streaming response...'
              : message.displayContent.split('\n').first,
          time: _formatTime(message.timestamp),
        ),
    ];

    return DraggableScrollableSheet(
      initialChildSize: 0.55,
      minChildSize: 0.35,
      maxChildSize: 0.85,
      builder: (context, scrollController) {
        return ListView(
          controller: scrollController,
          padding: const EdgeInsets.all(AppSpacing.md),
          children: [
            AiPanel(
              highlighted: true,
              header: Row(
                children: [
                  Text(
                    'Context Drawer',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
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
                  AiContextCard(label: 'Agent', value: agent.name),
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
                  const AgentSelector(),
                  const SizedBox(height: AppSpacing.sm),
                  const KnowledgeSelector(),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.md),
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
            const SizedBox(height: AppSpacing.md),
            const AiMemoryCard(
              title: 'Workspace Memory',
              summary: 'Persistent context used for generation.',
              items: [
                'Executive summaries prioritized',
                'Helios rollout remains top priority',
                'North grid alerts require urgency handling',
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            AiPanel(
              header: Text(
                'Reasoning Timeline',
                style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
              ),
              child: timeline.isEmpty
                  ? const AiEmptyState(
                      title: 'No reasoning events yet',
                      subtitle: 'Timeline appears as responses are generated.',
                      icon: Icons.timeline_rounded,
                    )
                  : AiTimeline(items: timeline),
            ),
          ],
        );
      },
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
    final hour = dt.hour % 12 == 0 ? 12 : dt.hour % 12;
    final minute = dt.minute.toString().padLeft(2, '0');
    final suffix = dt.hour >= 12 ? 'PM' : 'AM';
    return '$hour:$minute $suffix';
  }
}
