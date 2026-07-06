import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../shared/widgets/async_value_view.dart';
import '../../../../shared/widgets/pagination_bar.dart';
import '../../../../shared/widgets/pull_to_refresh.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../dashboard/presentation/widgets/dashboard_v2_tokens.dart';
import '../../../workflows/data/models/workflow_models.dart';
import '../../../workflows/presentation/providers/workflow_providers.dart';
import '../shell/ai_nav_bar.dart';
import '../widgets/ai_workspace_components.dart';

/// Workflows / automations screen — real backend-driven workflow list,
/// run history, metrics, health, and lifecycle actions (run, pause,
/// resume, cancel, retry) against the production Workflow Engine
/// (VT-024). Every value here now comes from `/workflows*`; nothing is
/// index-derived or fabricated.
class AiAutomationsScreen extends ConsumerWidget {
  const AiAutomationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedId = ref.watch(_selectedWorkflowIdProvider);
    final page = ref.watch(_workflowPageProvider);
    final status = ref.watch(workflowStatusFilterProvider);
    final workflows = ref.watch(
      workflowsProvider(WorkflowPageQuery(page: page, limit: 20, status: status)),
    );
    final mq = MediaQuery.sizeOf(context);
    final isDesktop = mq.width >= 1220;

    Future<void> refresh() async {
      ref.invalidate(workflowsProvider);
      if (selectedId != null) {
        ref.invalidate(workflowDetailProvider(selectedId));
        ref.invalidate(workflowMetricsProvider(selectedId));
        ref.invalidate(workflowHealthProvider(selectedId));
      }
    }

    final list = _WorkflowListPanel(
      workflows: workflows,
      selectedId: selectedId,
      page: page,
      status: status,
      onSelect: (id) => ref.read(_selectedWorkflowIdProvider.notifier).state = id,
      onPageChanged: (p) => ref.read(_workflowPageProvider.notifier).state = p,
      onStatusChanged: (s) {
        ref.read(workflowStatusFilterProvider.notifier).state = s;
        ref.read(_workflowPageProvider.notifier).state = 1;
      },
    );

    final detail = _WorkflowDetailPanel(workflowId: selectedId);

    return Column(
      children: [
        const AiNavBar(),
        Expanded(
          child: PullToRefresh(
            onRefresh: refresh,
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: isDesktop
                  ? SingleChildScrollView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      child: IntrinsicHeight(
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(flex: 4, child: list),
                            const SizedBox(width: AppSpacing.md),
                            Expanded(flex: 6, child: detail),
                          ],
                        ),
                      ),
                    )
                  : ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      children: [
                        list,
                        const SizedBox(height: AppSpacing.md),
                        detail,
                      ],
                    ),
            ),
          ),
        ),
      ],
    );
  }
}

final _selectedWorkflowIdProvider = StateProvider<String?>((ref) => null);
final _workflowPageProvider = StateProvider<int>((ref) => 1);

class _WorkflowListPanel extends StatelessWidget {
  const _WorkflowListPanel({
    required this.workflows,
    required this.selectedId,
    required this.page,
    required this.status,
    required this.onSelect,
    required this.onPageChanged,
    required this.onStatusChanged,
  });

  final AsyncValue<PaginatedWorkflowResult<Workflow>> workflows;
  final String? selectedId;
  final int page;
  final String? status;
  final ValueChanged<String?> onSelect;
  final ValueChanged<int> onPageChanged;
  final ValueChanged<String?> onStatusChanged;

  static const _statuses = ['DRAFT', 'PUBLISHED', 'ARCHIVED'];

  @override
  Widget build(BuildContext context) {
    return AiPanel(
      highlighted: true,
      header: Row(
        children: [
          Text(
            'Workflows',
            style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
          ),
          const Spacer(),
          workflows.maybeWhen(
            data: (result) => AiSuggestionChip(label: '${result.total} total'),
            orElse: () => const SizedBox.shrink(),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: AppSpacing.xs,
            children: [
              FilterChip(
                label: const Text('All'),
                selected: status == null,
                onSelected: (_) => onStatusChanged(null),
              ),
              for (final value in _statuses)
                FilterChip(
                  label: Text(value),
                  selected: status == value,
                  onSelected: (_) => onStatusChanged(value),
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          AsyncValueView<PaginatedWorkflowResult<Workflow>>(
            value: workflows,
            isEmpty: (result) => result.items.isEmpty,
            empty: (context) => const AiEmptyState(
              title: 'No workflows yet',
              subtitle: 'Workflows created and published from the backend will appear here.',
              icon: Icons.account_tree_outlined,
            ),
            data: (context, result) => Column(
              children: [
                for (final workflow in result.items)
                  Padding(
                    padding: const EdgeInsets.only(bottom: AppSpacing.xs),
                    child: _WorkflowListTile(
                      workflow: workflow,
                      selected: workflow.id == selectedId,
                      onTap: () => onSelect(workflow.id),
                    ),
                  ),
                PaginationBar(page: result.page, totalPages: result.totalPages, onPageChanged: onPageChanged),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _WorkflowListTile extends StatelessWidget {
  const _WorkflowListTile({required this.workflow, required this.selected, required this.onTap});

  final Workflow workflow;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = DashboardV2Tokens.of(context);

    return AiPanel(
      onTap: onTap,
      highlighted: selected,
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: AppSpacing.sm),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  workflow.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: selected ? t.primary : t.textPrimary,
                      ),
                ),
                if (workflow.description != null)
                  Text(
                    workflow.description!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(color: t.textSecondary),
                  ),
              ],
            ),
          ),
          AiSuggestionChip(label: workflow.status, icon: Icons.circle, color: _statusColor(workflow.status)),
        ],
      ),
    );
  }

  Color _statusColor(String status) {
    return switch (status) {
      'PUBLISHED' => Colors.green,
      'DRAFT' => Colors.orange,
      _ => Colors.grey,
    };
  }
}

class _WorkflowDetailPanel extends ConsumerWidget {
  const _WorkflowDetailPanel({required this.workflowId});

  final String? workflowId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (workflowId == null) {
      return const AiPanel(
        child: AiEmptyState(
          title: 'Select a workflow',
          subtitle: 'Choose a workflow from the list to view its metrics, health, and run history.',
          icon: Icons.account_tree_outlined,
        ),
      );
    }

    final id = workflowId!;
    final workflow = ref.watch(workflowDetailProvider(id));
    final metrics = ref.watch(workflowMetricsProvider(id));
    final health = ref.watch(workflowHealthProvider(id));
    final runsPage = ref.watch(_runsPageProvider);
    final runs = ref.watch(workflowRunsProvider(WorkflowRunsQuery(id, page: runsPage, limit: 10)));
    final actionState = ref.watch(workflowActionControllerProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        AsyncValueView<Workflow>(
          value: workflow,
          onRetry: () => ref.invalidate(workflowDetailProvider(id)),
          data: (context, result) => AiPanel(
            highlighted: true,
            header: Row(
              children: [
                Expanded(
                  child: Text(
                    result.name,
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
                  ),
                ),
                AiSuggestionChip(label: result.status),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (result.description != null) Text(result.description!),
                const SizedBox(height: AppSpacing.sm),
                if (actionState.errorMessage != null) ...[
                  InlineErrorCard(message: actionState.errorMessage!),
                  const SizedBox(height: AppSpacing.sm),
                ],
                Wrap(
                  spacing: AppSpacing.xs,
                  runSpacing: AppSpacing.xs,
                  children: [
                    FilledButton.icon(
                      onPressed: result.isPublished && !actionState.isLoading
                          ? () => ref.read(workflowActionControllerProvider.notifier).run(id)
                          : null,
                      icon: const Icon(Icons.play_arrow_rounded, size: 18),
                      label: const Text('Run'),
                    ),
                    if (!result.isPublished)
                      OutlinedButton.icon(
                        onPressed: actionState.isLoading
                            ? null
                            : () => ref.read(workflowActionControllerProvider.notifier).publish(id),
                        icon: const Icon(Icons.publish_rounded, size: 18),
                        label: const Text('Publish'),
                      ),
                    if (result.status != 'ARCHIVED')
                      OutlinedButton.icon(
                        onPressed: actionState.isLoading
                            ? null
                            : () => ref.read(workflowActionControllerProvider.notifier).archive(id),
                        icon: const Icon(Icons.archive_outlined, size: 18),
                        label: const Text('Archive'),
                      ),
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: AiPanel(
                header: Text(
                  'Metrics',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                ),
                child: AsyncValueView<WorkflowMetrics>(
                  value: metrics,
                  onRetry: () => ref.invalidate(workflowMetricsProvider(id)),
                  data: (context, result) => Column(
                    children: [
                      AiContextCard(label: 'Total Runs', value: '${result.totalRuns}'),
                      const SizedBox(height: AppSpacing.xs),
                      AiContextCard(
                        label: 'Success Rate',
                        value: '${(result.successRate * 100).toStringAsFixed(1)}%',
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      AiContextCard(label: 'Failed Runs', value: '${result.failedRuns}'),
                      const SizedBox(height: AppSpacing.xs),
                      AiContextCard(
                        label: 'Avg. Execution Time',
                        value: '${(result.averageExecutionTimeMs / 1000).toStringAsFixed(1)}s',
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      AiContextCard(label: 'Total Retries', value: '${result.totalRetries}'),
                      const SizedBox(height: AppSpacing.xs),
                      AiContextCard(
                        label: 'Total Cost',
                        value: '\$${result.totalCostUsd.toStringAsFixed(4)}',
                      ),
                    ],
                  ),
                ),
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: AiPanel(
                header: Text(
                  'Health',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                ),
                child: AsyncValueView<WorkflowHealth>(
                  value: health,
                  onRetry: () => ref.invalidate(workflowHealthProvider(id)),
                  data: (context, result) => Column(
                    children: [
                      AiContextCard(
                        label: 'Status',
                        value: result.healthy ? 'Healthy' : 'Needs attention',
                      ),
                      for (final reason in result.reasons) ...[
                        const SizedBox(height: AppSpacing.xs),
                        AiContextCard(label: 'Reason', value: reason),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.md),
        AiPanel(
          header: Text(
            'Run History',
            style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
          ),
          child: AsyncValueView<PaginatedWorkflowResult<WorkflowRun>>(
            value: runs,
            onRetry: () => ref.invalidate(workflowRunsProvider(WorkflowRunsQuery(id, page: runsPage, limit: 10))),
            isEmpty: (result) => result.items.isEmpty,
            empty: (context) => const AiEmptyState(
              title: 'No runs yet',
              subtitle: 'Run this workflow to see its execution history here.',
              icon: Icons.history_rounded,
            ),
            data: (context, result) => Column(
              children: [
                for (final run in result.items)
                  Padding(
                    padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                    child: _RunTile(
                      run: run,
                      workflowId: id,
                      isLoading: actionState.isLoading,
                    ),
                  ),
                PaginationBar(
                  page: result.page,
                  totalPages: result.totalPages,
                  onPageChanged: (p) => ref.read(_runsPageProvider.notifier).state = p,
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

final _runsPageProvider = StateProvider<int>((ref) => 1);

class _RunTile extends ConsumerWidget {
  const _RunTile({required this.run, required this.workflowId, required this.isLoading});

  final WorkflowRun run;
  final String workflowId;
  final bool isLoading;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final controller = ref.read(workflowActionControllerProvider.notifier);

    return AiPanel(
      highlighted: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'Run ${run.id.substring(0, run.id.length < 8 ? run.id.length : 8)}',
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                ),
              ),
              AiSuggestionChip(label: run.status, icon: Icons.circle, color: _statusColor(run.status)),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Text('Trigger: ${run.triggerType}', style: Theme.of(context).textTheme.bodySmall),
          if (run.durationMs != null)
            Text(
              'Duration: ${(run.durationMs! / 1000).toStringAsFixed(1)}s',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          if (run.error != null)
            Text(
              run.error!,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Theme.of(context).colorScheme.error),
            ),
          const SizedBox(height: AppSpacing.xs),
          Wrap(
            spacing: AppSpacing.xs,
            children: [
              if (run.isPaused)
                OutlinedButton(
                  onPressed: isLoading ? null : () => controller.resume(run.id, workflowId: workflowId),
                  child: const Text('Resume'),
                ),
              if (run.isActive)
                OutlinedButton(
                  onPressed: isLoading ? null : () => controller.pause(run.id, workflowId: workflowId),
                  child: const Text('Pause'),
                ),
              if (run.isActive || run.isPaused)
                OutlinedButton(
                  onPressed: isLoading ? null : () => controller.cancel(run.id, workflowId: workflowId),
                  child: const Text('Cancel'),
                ),
              if (run.isFailed)
                FilledButton.tonal(
                  onPressed: isLoading ? null : () => controller.retry(run.id, workflowId: workflowId),
                  child: const Text('Retry'),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Color _statusColor(String status) {
    return switch (status) {
      'SUCCEEDED' => Colors.green,
      'FAILED' => Colors.redAccent,
      'RUNNING' => Colors.blueAccent,
      'PAUSED' => Colors.orange,
      'CANCELLED' => Colors.grey,
      _ => Colors.blueGrey,
    };
  }
}
