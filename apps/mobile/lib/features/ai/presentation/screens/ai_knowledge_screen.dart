import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../theme/components/voltx_card.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';
import '../../data/models/ai_models.dart';
import '../providers/ai_providers.dart';
import '../shell/ai_nav_bar.dart';

/// Knowledge base management screen.
class AiKnowledgeScreen extends ConsumerWidget {
  const AiKnowledgeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bases = ref.watch(knowledgeBasesProvider);
    final selected = ref.watch(selectedKnowledgeProvider);
    final colors = context.voltxColors;

    return Column(
      children: [
        const AiNavBar(),
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.all(AppSpacing.md),
            itemCount: bases.length,
            itemBuilder: (context, index) {
              final kb = bases[index];
              return Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                child: VoltxCard(
                  onTap: () => ref.read(selectedKnowledgeProvider.notifier).state = kb,
                  child: Row(
                    children: [
                      Icon(
                        Icons.menu_book_outlined,
                        color: kb.id == selected.id
                            ? Theme.of(context).colorScheme.primary
                            : colors.textSecondary,
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(kb.name, style: Theme.of(context).textTheme.titleSmall),
                            Text(
                              kb.description,
                              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: colors.textSecondary,
                                  ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '${kb.documentCount} documents · ${_synced(kb)}',
                              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                    color: colors.textTertiary,
                                  ),
                            ),
                          ],
                        ),
                      ),
                      if (kb.id == selected.id)
                        Icon(Icons.check_circle_rounded, color: Theme.of(context).colorScheme.primary),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  String _synced(AiKnowledgeBase kb) {
    final diff = DateTime.now().difference(kb.lastSynced);
    if (diff.inHours < 24) {
      return '${diff.inHours}h ago';
    }
    return '${diff.inDays}d ago';
  }
}
