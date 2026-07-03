import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../theme/components/voltx_card.dart';
import '../../../../theme/components/voltx_chip.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';
import '../providers/ai_providers.dart';
import '../shell/ai_nav_bar.dart';

/// Browse and select AI agents.
class AiAgentsScreen extends ConsumerWidget {
  const AiAgentsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final agents = ref.watch(agentsProvider);
    final selected = ref.watch(selectedAgentProvider);
    final colors = context.voltxColors;

    return Column(
      children: [
        const AiNavBar(),
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.all(AppSpacing.md),
            itemCount: agents.length,
            itemBuilder: (context, index) {
              final agent = agents[index];
              final isSelected = agent.id == selected.id;

              return Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                child: VoltxCard(
                  variant: isSelected ? VoltxCardVariant.elevated : VoltxCardVariant.outlined,
                  onTap: () => ref.read(selectedAgentProvider.notifier).state = agent,
                  child: Row(
                    children: [
                      Icon(aiIcon(agent.iconName), color: Theme.of(context).colorScheme.primary),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              agent.name,
                              style: Theme.of(context).textTheme.titleSmall,
                            ),
                            Text(
                              agent.description,
                              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: colors.textSecondary,
                                  ),
                            ),
                          ],
                        ),
                      ),
                      if (isSelected)
                        const VoltxChip(label: 'Active', variant: VoltxChipVariant.primary),
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
}
