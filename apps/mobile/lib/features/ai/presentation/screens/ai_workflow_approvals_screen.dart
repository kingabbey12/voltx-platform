import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../shared/widgets/async_value_view.dart';
import '../../../../shared/widgets/pagination_bar.dart';
import '../../../../shared/widgets/pull_to_refresh.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../workflows/data/models/workflow_models.dart';
import '../../../workflows/presentation/providers/workflow_providers.dart';
import '../shell/ai_nav_bar.dart';
import '../widgets/ai_workspace_components.dart';

/// Pending workflow approvals inbox — every org member with
/// `workflow.approve` sees the same organization-wide queue here,
/// independent of which workflow/run a given approval belongs to.
class AiWorkflowApprovalsScreen extends ConsumerWidget {
  const AiWorkflowApprovalsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final page = ref.watch(workflowApprovalsPageProvider);
    final approvals = ref.watch(workflowApprovalsProvider(page));
    final actionState = ref.watch(workflowApprovalActionControllerProvider);

    Future<void> refresh() async {
      ref.invalidate(workflowApprovalsProvider);
    }

    return Column(
      children: [
        const AiNavBar(),
        Expanded(
          child: PullToRefresh(
            onRefresh: refresh,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(AppSpacing.md),
              children: [
                Text(
                  'Approvals',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  'Workflow runs paused on an approval step, waiting on a decision.',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: AppSpacing.md),
                if (actionState.errorMessage != null) ...[
                  InlineErrorCard(message: actionState.errorMessage!),
                  const SizedBox(height: AppSpacing.sm),
                ],
                AsyncValueView<PaginatedWorkflowResult<WorkflowApproval>>(
                  value: approvals,
                  onRetry: () => ref.invalidate(workflowApprovalsProvider),
                  isEmpty: (result) => result.items.isEmpty,
                  empty: (context) => const AiEmptyState(
                    title: 'Nothing pending',
                    subtitle: 'Approval requests from running workflows will show up here.',
                    icon: Icons.rule_folder_outlined,
                  ),
                  data: (context, result) => Column(
                    children: [
                      for (final approval in result.items)
                        Padding(
                          padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                          child: _ApprovalCard(approval: approval, isLoading: actionState.isLoading),
                        ),
                      PaginationBar(
                        page: result.page,
                        totalPages: result.totalPages,
                        onPageChanged: (p) => ref.read(workflowApprovalsPageProvider.notifier).state = p,
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

class _ApprovalCard extends ConsumerWidget {
  const _ApprovalCard({required this.approval, required this.isLoading});

  final WorkflowApproval approval;
  final bool isLoading;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final controller = ref.read(workflowApprovalActionControllerProvider.notifier);
    final shortRunId = approval.workflowRunId.substring(
      0,
      approval.workflowRunId.length < 8 ? approval.workflowRunId.length : 8,
    );

    return AiPanel(
      highlighted: true,
      header: Row(
        children: [
          Expanded(
            child: Text(
              'Run $shortRunId',
              style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
            ),
          ),
          AiSuggestionChip(label: approval.status, icon: Icons.hourglass_top_rounded),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Requested ${approval.createdAt}', style: Theme.of(context).textTheme.bodySmall),
          if (approval.expiresAt != null)
            Text('Expires ${approval.expiresAt}', style: Theme.of(context).textTheme.bodySmall),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.xs,
            children: [
              OutlinedButton.icon(
                onPressed: isLoading
                    ? null
                    : () => controller.decide(approval.id, decision: 'REJECTED'),
                icon: const Icon(Icons.close_rounded, size: 18),
                label: const Text('Reject'),
              ),
              FilledButton.icon(
                onPressed: isLoading
                    ? null
                    : () => controller.decide(approval.id, decision: 'APPROVED'),
                icon: const Icon(Icons.check_rounded, size: 18),
                label: const Text('Approve'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
