import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../theme/components/voltx_text_field.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../data/models/ai_models.dart';
import '../providers/ai_providers.dart';
import 'ai_workspace_components.dart';

/// Conversation history sidebar list.
class ConversationList extends ConsumerWidget {
  const ConversationList({
    required this.onSelect,
    this.fillAvailableHeight = true,
    super.key,
  });

  final ValueChanged<String> onSelect;
  final bool fillAvailableHeight;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final conversations = ref.watch(conversationsProvider);
    final activeId = ref.watch(activeConversationIdProvider);
    final query = ref.watch(conversationSearchProvider);
    final pinned = conversations.where((c) => c.pinned).toList();
    final recent = conversations.where((c) => !c.pinned).toList();
    final totalMessages = conversations.fold<int>(0, (sum, item) => sum + item.messageCount);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Wrap(
          spacing: AppSpacing.xs,
          runSpacing: AppSpacing.xs,
          children: [
            AiSuggestionChip(
              label: '${conversations.length} chats',
              icon: Icons.chat_bubble_outline_rounded,
            ),
            AiSuggestionChip(
              label: '$totalMessages messages',
              icon: Icons.timeline_rounded,
            ),
            const AiSuggestionChip(
              label: 'Memory synced',
              icon: Icons.memory_rounded,
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        VoltxTextField(
          hint: 'Search chats…',
          prefixIcon: Icons.search_rounded,
          onChanged: (value) =>
              ref.read(conversationSearchProvider.notifier).state = value,
        ),
        if (query.trim().isNotEmpty) ...[
          const SizedBox(height: AppSpacing.xs),
          AiSuggestionChip(
            label: 'Filter: ${query.trim()}',
            icon: Icons.filter_alt_outlined,
            onTap: () => ref.read(conversationSearchProvider.notifier).state = '',
          ),
        ],
        const SizedBox(height: AppSpacing.sm),
        if (pinned.isNotEmpty) ...[
          _SectionHeader(title: 'Pinned', icon: Icons.push_pin_outlined),
          for (final conv in pinned)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.xs),
              child: AiConversationCard(
                conversation: conv,
                selected: conv.id == activeId,
                onTap: () => onSelect(conv.id),
              ),
            ),
          const SizedBox(height: AppSpacing.sm),
        ],
        _SectionHeader(title: 'Recent', icon: Icons.history_rounded),
        if (fillAvailableHeight)
          Expanded(
            child: ListView(
              children: _buildRecent(recent, activeId),
            ),
          )
        else
          ListView(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            children: _buildRecent(recent, activeId),
          ),
      ],
    );
  }

  List<Widget> _buildRecent(List<AiConversation> recent, String activeId) {
    return [
      if (recent.isEmpty)
        const AiEmptyState(
          title: 'No conversations',
          subtitle: 'New conversations will appear here as you work with AI.',
          icon: Icons.chat_bubble_outline_rounded,
        ),
      for (final conv in recent)
        Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.xs),
          child: AiConversationCard(
            conversation: conv,
            selected: conv.id == activeId,
            onTap: () => onSelect(conv.id),
          ),
        ),
    ];
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title, required this.icon});

  final String title;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
      child: Row(
        children: [
          Icon(icon, size: 14),
          const SizedBox(width: AppSpacing.xxs),
          Text(
            title,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  fontWeight: FontWeight.w600,
                ),
          ),
        ],
      ),
    );
  }
}
