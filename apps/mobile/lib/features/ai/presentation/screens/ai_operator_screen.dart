import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../theme/tokens/spacing.dart';
import '../../data/models/ai_models.dart';
import '../providers/ai_providers.dart';
import '../shell/ai_nav_bar.dart';
import '../widgets/ai_workspace_components.dart';

/// AI Operator dashboard: activity, pending tasks (approvals), performance,
/// and proactive suggestions — all backed by the real
/// `/ai/dashboard/*` and `/ai/approvals` endpoints.
class AiOperatorScreen extends HookConsumerWidget {
  const AiOperatorScreen({super.key});

  static const _tabs = ['Tasks', 'Activity', 'Performance', 'Suggestions'];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tabIndex = useState(0);

    return Column(
      children: [
        const AiNavBar(),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.sm),
          child: Wrap(
            spacing: AppSpacing.xs,
            children: [
              for (var i = 0; i < _tabs.length; i++)
                AiSuggestionChip(
                  label: _tabs[i],
                  onTap: () => tabIndex.value = i,
                  color: tabIndex.value == i ? Theme.of(context).colorScheme.primary : null,
                ),
            ],
          ),
        ),
        Expanded(
          child: switch (tabIndex.value) {
            1 => const _ActivityTab(),
            2 => const _PerformanceTab(),
            3 => const _SuggestionsTab(),
            _ => const _TasksTab(),
          },
        ),
      ],
    );
  }
}

class _TasksTab extends ConsumerWidget {
  const _TasksTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final tasks = ref.watch(aiDashboardTasksProvider);

    return tasks.when(
      loading: () => const Padding(
        padding: EdgeInsets.all(AppSpacing.md),
        child: AiLoadingState(),
      ),
      error: (error, _) => Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: AiEmptyState(
          title: 'Could not load tasks',
          subtitle: '$error',
          icon: Icons.error_outline,
        ),
      ),
      data: (summary) {
        if (summary.pendingApprovals.isEmpty && summary.inProgressRuns.isEmpty) {
          return const Padding(
            padding: EdgeInsets.all(AppSpacing.md),
            child: AiEmptyState(
              title: 'Nothing needs your attention',
              subtitle: 'Pending approvals and in-progress runs will appear here.',
              icon: Icons.check_circle_outline,
            ),
          );
        }

        return ListView(
          padding: const EdgeInsets.all(AppSpacing.md),
          children: [
            if (summary.pendingApprovals.isNotEmpty) ...[
              Text(
                'Pending approvals',
                style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: AppSpacing.sm),
              for (final approval in summary.pendingApprovals)
                Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                  child: _ApprovalCard(approval: approval),
                ),
              const SizedBox(height: AppSpacing.md),
            ],
            if (summary.inProgressRuns.isNotEmpty) ...[
              Text(
                'In progress',
                style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: AppSpacing.sm),
              for (final run in summary.inProgressRuns)
                Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                  child: AiPanel(
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            run.outputText?.isNotEmpty == true ? run.outputText! : run.id,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        AiSuggestionChip(label: run.status),
                      ],
                    ),
                  ),
                ),
            ],
          ],
        );
      },
    );
  }
}

class _ApprovalCard extends ConsumerStatefulWidget {
  const _ApprovalCard({required this.approval});

  final AgentApproval approval;

  @override
  ConsumerState<_ApprovalCard> createState() => _ApprovalCardState();
}

class _ApprovalCardState extends ConsumerState<_ApprovalCard> {
  bool _deciding = false;

  Future<void> _decide(String decision) async {
    setState(() => _deciding = true);
    try {
      await ref.read(aiDashboardTasksProvider.notifier).decide(
            widget.approval.id,
            decision: decision,
          );
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not record your decision. Please try again.')),
        );
      }
    } finally {
      if (mounted) {
        setState(() => _deciding = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return AiPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  widget.approval.toolName,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                ),
              ),
              const AiSuggestionChip(label: 'Needs approval', icon: Icons.pending_actions_rounded),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            widget.approval.input.toString(),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              OutlinedButton(
                onPressed: _deciding ? null : () => _decide('REJECTED'),
                child: const Text('Reject'),
              ),
              const SizedBox(width: AppSpacing.sm),
              FilledButton(
                onPressed: _deciding ? null : () => _decide('APPROVED'),
                child: const Text('Approve'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ActivityTab extends ConsumerWidget {
  const _ActivityTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final activity = ref.watch(aiDashboardActivityProvider);

    return activity.when(
      loading: () => const Padding(
        padding: EdgeInsets.all(AppSpacing.md),
        child: AiLoadingState(),
      ),
      error: (_, _) => const Padding(
        padding: EdgeInsets.all(AppSpacing.md),
        child: AiEmptyState(
          title: 'Could not load activity',
          subtitle: 'Please try again shortly.',
          icon: Icons.error_outline,
        ),
      ),
      data: (runs) {
        if (runs.isEmpty) {
          return const Padding(
            padding: EdgeInsets.all(AppSpacing.md),
            child: AiEmptyState(
              title: 'No agent activity yet',
              subtitle: 'Runs will show up here as soon as an agent executes.',
              icon: Icons.timeline_rounded,
            ),
          );
        }

        return ListView(
          padding: const EdgeInsets.all(AppSpacing.md),
          children: [
            AiTimeline(
              items: [
                for (final run in runs)
                  AiTimelineItem(
                    title: run.outputText?.isNotEmpty == true ? run.outputText! : run.status,
                    subtitle: '${run.toolCallCount} tool call${run.toolCallCount == 1 ? '' : 's'}',
                    time: _relativeTime(run.startedAt),
                  ),
              ],
            ),
          ],
        );
      },
    );
  }
}

class _PerformanceTab extends ConsumerWidget {
  const _PerformanceTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final performance = ref.watch(aiDashboardPerformanceProvider);

    return performance.when(
      loading: () => const Padding(
        padding: EdgeInsets.all(AppSpacing.md),
        child: AiLoadingState(),
      ),
      error: (_, _) => const Padding(
        padding: EdgeInsets.all(AppSpacing.md),
        child: AiEmptyState(
          title: 'Could not load performance',
          subtitle: 'Please try again shortly.',
          icon: Icons.error_outline,
        ),
      ),
      data: (summary) {
        if (summary == null) {
          return const Padding(
            padding: EdgeInsets.all(AppSpacing.md),
            child: AiEmptyState(
              title: 'No usage yet',
              subtitle: 'Performance stats will appear once agents start running.',
              icon: Icons.insights_rounded,
            ),
          );
        }

        return ListView(
          padding: const EdgeInsets.all(AppSpacing.md),
          children: [
            Row(
              children: [
                Expanded(
                  child: AiContextCard(
                    label: 'AI calls (${summary.lookbackDays}d)',
                    value: '${summary.totalCallCount}',
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: AiContextCard(
                    label: 'Tokens used',
                    value: summary.totalTokens.toString(),
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            AiContextCard(
              label: 'Estimated spend',
              value: '\$${summary.totalCostUsd.toStringAsFixed(2)}',
            ),
            if (summary.byAgent.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.md),
              Text(
                'By agent',
                style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: AppSpacing.sm),
              for (final entry in summary.byAgent)
                Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.xs),
                  child: AiContextCard(
                    label: entry.agentName ?? 'Direct chat',
                    value:
                        '${entry.callCount} calls · \$${entry.totalCostUsd.toStringAsFixed(2)}',
                  ),
                ),
            ],
          ],
        );
      },
    );
  }
}

class _SuggestionsTab extends ConsumerWidget {
  const _SuggestionsTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final suggestions = ref.watch(aiDashboardSuggestionsProvider);

    if (suggestions.isEmpty) {
      return const Padding(
        padding: EdgeInsets.all(AppSpacing.md),
        child: AiEmptyState(
          title: 'No suggestions right now',
          subtitle: 'Check back later — the Executive Assistant reviews activity periodically.',
          icon: Icons.auto_awesome_rounded,
        ),
      );
    }

    return ListView(
      padding: const EdgeInsets.all(AppSpacing.md),
      children: [
        for (final suggestion in suggestions)
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.sm),
            child: AiPanel(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      AiSuggestionChip(label: suggestion.category),
                      const Spacer(),
                      Text(
                        _relativeTime(suggestion.createdAt),
                        style: Theme.of(context).textTheme.labelSmall,
                      ),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    suggestion.title,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    suggestion.description,
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Align(
                    alignment: Alignment.centerRight,
                    child: OutlinedButton(
                      onPressed: () =>
                          ref.read(aiDashboardSuggestionsProvider.notifier).dismiss(suggestion.id),
                      child: const Text('Dismiss'),
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

String _relativeTime(DateTime dt) {
  final diff = DateTime.now().difference(dt);
  if (diff.inMinutes < 60) {
    return '${diff.inMinutes}m ago';
  }
  if (diff.inHours < 24) {
    return '${diff.inHours}h ago';
  }
  return '${diff.inDays}d ago';
}
