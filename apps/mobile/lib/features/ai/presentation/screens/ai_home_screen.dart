import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../router/routes.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../data/models/ai_models.dart';
import '../../data/mock/mock_ai_data.dart';
import '../providers/ai_providers.dart';
import '../shell/ai_nav_bar.dart';
import '../widgets/suggested_prompts.dart';
import '../widgets/ai_workspace_components.dart';

/// AI workspace landing with suggested prompts and quick links.
class AiHomeScreen extends ConsumerWidget {
  const AiHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final pinned = ref.watch(pinnedConversationsProvider);
    final selectedAgent = ref.watch(selectedAgentProvider);
    final selectedKnowledge = ref.watch(selectedKnowledgeProvider);
    final automations = ref.watch(automationsProvider);
    final isMobile = MediaQuery.sizeOf(context).width < 860;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const AiNavBar(),
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AiPanel(
                  header: Wrap(
                    spacing: AppSpacing.sm,
                    runSpacing: AppSpacing.sm,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      const Icon(Icons.auto_awesome_rounded, size: 22),
                      Text(
                        'AI Executive Workspace',
                        style: Theme.of(context)
                            .textTheme
                            .headlineSmall
                            ?.copyWith(fontWeight: FontWeight.w800),
                      ),
                      AiSuggestionChip(
                        label: selectedAgent.name,
                        icon: Icons.smart_toy_outlined,
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Your AI is operating as an executive partner with live context, memory, connected knowledge, and tool-ready workflows.',
                        style: Theme.of(context).textTheme.bodyLarge,
                      ),
                      const SizedBox(height: AppSpacing.md),
                      Wrap(
                        spacing: AppSpacing.xs,
                        runSpacing: AppSpacing.xs,
                        children: [
                          AiSuggestionChip(label: 'Knowledge: ${selectedKnowledge.name}', icon: Icons.menu_book_outlined),
                          AiSuggestionChip(
                            label: '${automations.where((a) => a.enabled).length} automations active',
                            icon: Icons.bolt_rounded,
                          ),
                          const AiSuggestionChip(label: 'Memory synced', icon: Icons.memory_rounded),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.lg),
                if (isMobile)
                  _HomeMobileSections(pinned: pinned)
                else
                  _HomeDesktopSections(pinned: pinned),
                const SizedBox(height: AppSpacing.md),
                Text(
                  'Quick Launch',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: AppSpacing.sm),
                Wrap(
                  spacing: AppSpacing.sm,
                  runSpacing: AppSpacing.sm,
                  children: [
                    _QuickLink(
                      label: 'Open AI chat',
                      icon: Icons.chat_bubble_outline_rounded,
                      onTap: () => context.go(AppRoutes.aiChat),
                    ),
                    _QuickLink(
                      label: 'Browse agents',
                      icon: Icons.smart_toy_outlined,
                      onTap: () => context.go(AppRoutes.aiAgents),
                    ),
                    _QuickLink(
                      label: 'Knowledge bases',
                      icon: Icons.menu_book_outlined,
                      onTap: () => context.go(AppRoutes.aiKnowledge),
                    ),
                    _QuickLink(
                      label: 'Automations',
                      icon: Icons.bolt_outlined,
                      onTap: () => context.go(AppRoutes.aiAutomations),
                    ),
                    _QuickLink(
                      label: 'Conversation history',
                      icon: Icons.history_rounded,
                      onTap: () => context.go(AppRoutes.aiHistory),
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

class _QuickLink extends StatelessWidget {
  const _QuickLink({
    required this.label,
    required this.icon,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return AiSuggestionChip(
      label: label,
      icon: icon,
      onTap: onTap,
    );
  }
}

class _HomeDesktopSections extends ConsumerWidget {
  const _HomeDesktopSections({required this.pinned});

  final List<AiConversation> pinned;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          flex: 6,
          child: AiPanel(
            header: Text(
              'Suggested Actions',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
            ),
            child: Column(
              children: [
                SuggestedPrompts(
                  onSelect: (prompt) {
                    final convId = MockAiData.conversations.first.id;
                    ref.read(activeConversationIdProvider.notifier).state = convId;
                    context.go(AppRoutes.aiChat);
                    ref.read(aiChatProvider(convId).notifier).sendMessage(prompt);
                  },
                ),
                const SizedBox(height: AppSpacing.md),
                AiMemoryCard(
                  title: 'Memory Summary',
                  summary: 'Persistent strategic context currently loaded in workspace.',
                  items: const [
                    'Executive digest style: concise with recommendations',
                    'Priority region: North grid resilience and demand shifts',
                    'Program Helios milestones are critical this quarter',
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(width: AppSpacing.md),
        Expanded(
          flex: 5,
          child: AiPanel(
            header: Text(
              'Pinned Conversations',
              style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
            ),
            child: pinned.isEmpty
                ? const AiEmptyState(
                    title: 'No pinned conversations',
                    subtitle: 'Pin key threads to keep executive context in view.',
                    icon: Icons.push_pin_outlined,
                  )
                : Column(
                    children: [
                      for (final conv in pinned)
                        Padding(
                          padding: const EdgeInsets.only(bottom: AppSpacing.xs),
                          child: AiConversationCard(
                            conversation: conv,
                            selected: false,
                            onTap: () {
                              ref.read(activeConversationIdProvider.notifier).state = conv.id;
                              context.go(AppRoutes.aiChat);
                            },
                          ),
                        ),
                    ],
                  ),
          ),
        ),
      ],
    );
  }
}

class _HomeMobileSections extends ConsumerWidget {
  const _HomeMobileSections({required this.pinned});

  final List<AiConversation> pinned;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Column(
      children: [
        AiPanel(
          header: Text(
            'Suggested Actions',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
          ),
          child: SuggestedPrompts(
            onSelect: (prompt) {
              final convId = MockAiData.conversations.first.id;
              ref.read(activeConversationIdProvider.notifier).state = convId;
              context.go(AppRoutes.aiChat);
              ref.read(aiChatProvider(convId).notifier).sendMessage(prompt);
            },
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        AiPanel(
          header: Text(
            'Pinned Conversations',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
          ),
          child: pinned.isEmpty
              ? const AiEmptyState(
                  title: 'No pinned conversations',
                  subtitle: 'Pin key threads to keep executive context in view.',
                  icon: Icons.push_pin_outlined,
                )
              : Column(
                  children: [
                    for (final conv in pinned)
                      Padding(
                        padding: const EdgeInsets.only(bottom: AppSpacing.xs),
                        child: AiConversationCard(
                          conversation: conv,
                          selected: false,
                          onTap: () {
                            ref.read(activeConversationIdProvider.notifier).state = conv.id;
                            context.go(AppRoutes.aiChat);
                          },
                        ),
                      ),
                  ],
                ),
        ),
      ],
    );
  }
}
