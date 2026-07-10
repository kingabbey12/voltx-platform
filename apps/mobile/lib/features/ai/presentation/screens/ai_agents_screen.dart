import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../shared/widgets/empty_state.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../data/models/ai_models.dart';
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
                    child: Consumer(
                      builder: (context, ref, _) {
                        final stats = ref.watch(agentStatsProvider(agent.id)).valueOrNull;
                        return AiAgentCard(
                          agent: agent,
                          selected: agent.id == selected.id,
                          onTap: () => ref.read(selectedAgentProvider.notifier).state = agent,
                          status: agent.id == selected.id ? 'Selected' : 'Available',
                          secondaryLabel: _successRateLabel(stats),
                          toolCount: stats?.toolCount ?? 0,
                          recentActivity: _recentActivityLabel(stats),
                          onRun: () => ref.read(selectedAgentProvider.notifier).state = agent,
                        );
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

String _successRateLabel(AgentStats? stats) {
  if (stats == null || stats.totalRunCount == 0) {
    return 'No runs yet';
  }
  final rate = stats.successRate;
  if (rate == null) {
    return 'No runs yet';
  }
  return '${(rate * 100).round()}% success';
}

String _recentActivityLabel(AgentStats? stats) {
  if (stats == null || stats.totalRunCount == 0) {
    return 'Awaiting first run';
  }
  final lastRunAt = stats.lastRunAt;
  if (lastRunAt == null) {
    return '${stats.totalRunCount} run${stats.totalRunCount == 1 ? '' : 's'} total';
  }
  final diff = DateTime.now().difference(lastRunAt);
  final time = diff.inMinutes < 60
      ? '${diff.inMinutes}m ago'
      : diff.inHours < 24
          ? '${diff.inHours}h ago'
          : '${diff.inDays}d ago';
  return 'Last run $time';
}
