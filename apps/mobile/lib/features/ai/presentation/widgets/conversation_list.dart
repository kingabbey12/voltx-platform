import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../theme/components/voltx_text_field.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';
import '../../data/models/ai_models.dart';
import '../providers/ai_providers.dart';

/// Conversation history sidebar list.
class ConversationList extends ConsumerWidget {
  const ConversationList({
    required this.onSelect,
    super.key,
  });

  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final conversations = ref.watch(conversationsProvider);
    final activeId = ref.watch(activeConversationIdProvider);
    final pinned = conversations.where((c) => c.pinned).toList();
    final recent = conversations.where((c) => !c.pinned).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        VoltxTextField(
          hint: 'Search chats…',
          prefixIcon: Icons.search_rounded,
          onChanged: (value) =>
              ref.read(conversationSearchProvider.notifier).state = value,
        ),
        const SizedBox(height: AppSpacing.sm),
        if (pinned.isNotEmpty) ...[
          _SectionHeader(title: 'Pinned', icon: Icons.push_pin_outlined),
          for (final conv in pinned)
            _ConversationTile(
              conversation: conv,
              selected: conv.id == activeId,
              onTap: () => onSelect(conv.id),
            ),
          const SizedBox(height: AppSpacing.sm),
        ],
        _SectionHeader(title: 'Recent', icon: Icons.history_rounded),
        Expanded(
          child: ListView(
            children: [
              for (final conv in recent)
                _ConversationTile(
                  conversation: conv,
                  selected: conv.id == activeId,
                  onTap: () => onSelect(conv.id),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title, required this.icon});

  final String title;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final colors = context.voltxColors;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
      child: Row(
        children: [
          Icon(icon, size: 14, color: colors.textTertiary),
          const SizedBox(width: AppSpacing.xxs),
          Text(
            title,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: colors.textTertiary,
                  fontWeight: FontWeight.w600,
                ),
          ),
        ],
      ),
    );
  }
}

class _ConversationTile extends StatelessWidget {
  const _ConversationTile({
    required this.conversation,
    required this.selected,
    required this.onTap,
  });

  final AiConversation conversation;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.voltxColors;
    final scheme = Theme.of(context).colorScheme;

    return Material(
      color: selected ? scheme.primary.withValues(alpha: 0.08) : Colors.transparent,
      borderRadius: BorderRadius.circular(10),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(10),
        child: Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.sm,
            vertical: AppSpacing.xs,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                conversation.title,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                    ),
              ),
              Text(
                conversation.preview,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: colors.textTertiary,
                    ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
