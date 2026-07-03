import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../theme/components/voltx_card.dart';
import '../../../../theme/components/voltx_chip.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';
import '../providers/ai_providers.dart';

/// Model selector dropdown.
class ModelSelector extends ConsumerWidget {
  const ModelSelector({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final models = ref.watch(aiModelsProvider);
    final selected = ref.watch(selectedModelProvider);

    return DropdownButtonHideUnderline(
      child: DropdownButton<String>(
        value: selected.id,
        isDense: true,
        items: [
          for (final model in models)
            DropdownMenuItem(
              value: model.id,
              child: Text(model.name),
            ),
        ],
        onChanged: (id) {
          if (id == null) {
            return;
          }
          final model = models.firstWhere((m) => m.id == id);
          ref.read(selectedModelProvider.notifier).state = model;
        },
      ),
    );
  }
}

/// Agent selector chip row.
class AgentSelector extends ConsumerWidget {
  const AgentSelector({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final agents = ref.watch(agentsProvider);
    final selected = ref.watch(selectedAgentProvider);

    return Wrap(
      spacing: AppSpacing.xs,
      runSpacing: AppSpacing.xs,
      children: [
        for (final agent in agents)
          VoltxChip(
            label: agent.name,
            selected: agent.id == selected.id,
            icon: aiIcon(agent.iconName),
            onTap: () => ref.read(selectedAgentProvider.notifier).state = agent,
          ),
      ],
    );
  }
}

/// Knowledge base selector.
class KnowledgeSelector extends ConsumerWidget {
  const KnowledgeSelector({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bases = ref.watch(knowledgeBasesProvider);
    final selected = ref.watch(selectedKnowledgeProvider);
    final colors = context.voltxColors;
    final scheme = Theme.of(context).colorScheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (final kb in bases)
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.xs),
            child: VoltxCard(
              variant: kb.id == selected.id
                  ? VoltxCardVariant.elevated
                  : VoltxCardVariant.outlined,
              onTap: () => ref.read(selectedKnowledgeProvider.notifier).state = kb,
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.sm,
                vertical: AppSpacing.xs,
              ),
              child: Row(
                children: [
                  Icon(
                    kb.id == selected.id
                        ? Icons.check_circle_rounded
                        : Icons.circle_outlined,
                    size: 18,
                    color: kb.id == selected.id ? scheme.primary : colors.textTertiary,
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(kb.name, style: Theme.of(context).textTheme.bodyMedium),
                        Text(
                          '${kb.documentCount} docs',
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                color: colors.textSecondary,
                              ),
                        ),
                      ],
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
