import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../router/routes.dart';
import '../../../../theme/components/voltx_card.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';
import '../../data/mock/mock_ai_data.dart';
import '../providers/ai_providers.dart';
import '../shell/ai_nav_bar.dart';
import '../widgets/suggested_prompts.dart';

/// AI workspace landing with suggested prompts and quick links.
class AiHomeScreen extends ConsumerWidget {
  const AiHomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.voltxColors;
    final scheme = Theme.of(context).colorScheme;
    final pinned = ref.watch(pinnedConversationsProvider);

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
                Row(
                  children: [
                    Icon(Icons.auto_awesome_rounded, color: scheme.primary, size: 28),
                    const SizedBox(width: AppSpacing.sm),
                    Text('Voltx AI', style: Theme.of(context).textTheme.headlineSmall),
                  ],
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  'Your intelligent operations assistant',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: colors.textSecondary,
                      ),
                ),
                const SizedBox(height: AppSpacing.lg),
                Text('Suggested prompts', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: AppSpacing.sm),
                SuggestedPrompts(
                  onSelect: (prompt) {
                    final convId = MockAiData.conversations.first.id;
                    ref.read(activeConversationIdProvider.notifier).state = convId;
                    context.go(AppRoutes.aiChat);
                    ref.read(aiChatProvider(convId).notifier).sendMessage(prompt);
                  },
                ),
                const SizedBox(height: AppSpacing.lg),
                Text('Pinned chats', style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: AppSpacing.sm),
                for (final conv in pinned)
                  Padding(
                    padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                    child: VoltxCard(
                      onTap: () {
                        ref.read(activeConversationIdProvider.notifier).state = conv.id;
                        context.go(AppRoutes.aiChat);
                      },
                      child: ListTile(
                        contentPadding: EdgeInsets.zero,
                        title: Text(conv.title),
                        subtitle: Text(
                          conv.preview,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        trailing: const Icon(Icons.chevron_right_rounded),
                      ),
                    ),
                  ),
                const SizedBox(height: AppSpacing.md),
                Wrap(
                  spacing: AppSpacing.sm,
                  children: [
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
    return ActionChip(
      avatar: Icon(icon, size: 18),
      label: Text(label),
      onPressed: onTap,
    );
  }
}
