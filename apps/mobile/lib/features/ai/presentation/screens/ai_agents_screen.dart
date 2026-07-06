import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../shared/widgets/empty_state.dart';
import '../../../../theme/tokens/spacing.dart';
import '../providers/ai_providers.dart';
import '../shell/ai_nav_bar.dart';
import '../widgets/ai_workspace_components.dart';

/// Browse and select AI agents.
class AiAgentsScreen extends ConsumerWidget {
  const AiAgentsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final agents = ref.watch(agentsProvider);
    final selected = ref.watch(selectedAgentProvider);

    return Column(
      children: [
        const AiNavBar(),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(AppSpacing.md),
            children: [
              AiPanel(
                header: Text(
                  'Agent Operations',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
                ),
                child: const Text(
                  'Choose the active executive AI agent, inspect capabilities, review memory usage, and launch strategic runs.',
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              if (agents.isEmpty)
                const EmptyState(
                  icon: Icons.smart_toy_outlined,
                  title: 'No agents yet',
                  message: 'AI agents created for this organization will appear here.',
                )
              else
                for (final agent in agents)
                  Padding(
                    padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                    child: AiAgentCard(
                      agent: agent,
                      selected: agent.id == selected.id,
                      onTap: () => ref.read(selectedAgentProvider.notifier).state = agent,
                      status: agent.id == selected.id ? 'Active' : 'Idle',
                      memoryUsage: agent.id == selected.id ? '72%' : '39%',
                      toolCount: agent.id == selected.id ? 8 : 5,
                      recentActivity: agent.id == selected.id
                          ? 'Processed executive brief 1m ago'
                          : 'Awaiting activation',
                      onRun: () => ref.read(selectedAgentProvider.notifier).state = agent,
                    ),
                  ),
            ],
          ),
        ),
      ],
    );
  }
}
