import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../router/routes.dart';
import '../../../../theme/tokens/spacing.dart';
import '../providers/ai_providers.dart';
import '../shell/ai_nav_bar.dart';
import '../widgets/conversation_list.dart';
import '../widgets/ai_workspace_components.dart';

/// Full conversation history screen.
class AiHistoryScreen extends ConsumerWidget {
  const AiHistoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final conversations = ref.watch(conversationsProvider);
    final pinned = conversations.where((c) => c.pinned).toList();
    final isCompact = MediaQuery.sizeOf(context).width < 980;
    final timelineItems = conversations
        .map(
          (c) => AiTimelineItem(
            title: c.title,
            subtitle: c.preview,
            time: '${c.messageCount} messages',
          ),
        )
        .toList();

    return Column(
      children: [
        const AiNavBar(),
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AiPanel(
                  header: Text(
                    'Conversation History',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
                  ),
                  child: Wrap(
                    spacing: AppSpacing.sm,
                    runSpacing: AppSpacing.sm,
                    children: [
                      AiSuggestionChip(label: '${conversations.length} conversations', icon: Icons.history_rounded),
                      AiSuggestionChip(label: '${pinned.length} pinned', icon: Icons.push_pin_outlined),
                      const AiSuggestionChip(label: 'Timeline mode', icon: Icons.timeline_rounded),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                if (isCompact) ...[
                  AiPanel(
                    header: Text(
                      'Search & Filter',
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                    ),
                    child: ConversationList(
                      fillAvailableHeight: false,
                      onSelect: (id) {
                        ref.read(activeConversationIdProvider.notifier).state = id;
                        context.go(AppRoutes.aiChat);
                      },
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  AiPanel(
                    header: Text(
                      'Timeline',
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                    ),
                    child: AiTimeline(items: timelineItems),
                  ),
                ] else
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        flex: 5,
                        child: AiPanel(
                          header: Text(
                            'Search & Filter',
                            style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                          ),
                          child: ConversationList(
                            fillAvailableHeight: false,
                            onSelect: (id) {
                              ref.read(activeConversationIdProvider.notifier).state = id;
                              context.go(AppRoutes.aiChat);
                            },
                          ),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.md),
                      Expanded(
                        flex: 6,
                        child: AiPanel(
                          header: Text(
                            'Timeline',
                            style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                          ),
                          child: AiTimeline(items: timelineItems),
                        ),
                      ),
                    ],
                  ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}
