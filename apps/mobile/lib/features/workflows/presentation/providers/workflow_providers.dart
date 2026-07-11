import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/network_providers.dart';
import '../../data/models/workflow_models.dart';
import '../../data/repositories/workflow_repository.dart';
import '../../data/services/workflow_api_service.dart';

final workflowApiServiceProvider = Provider<WorkflowApiService>((ref) {
  return WorkflowApiService(ref.watch(apiClientProvider));
});

final workflowRepositoryProvider = Provider<WorkflowRepository>((ref) {
  return ApiWorkflowRepository(ref.watch(workflowApiServiceProvider));
});

final workflowsProvider =
    FutureProvider.family<PaginatedWorkflowResult<Workflow>, WorkflowPageQuery>((ref, query) {
  return ref.watch(workflowRepositoryProvider).listWorkflows(query);
});

final workflowDetailProvider = FutureProvider.family<Workflow, String>((ref, id) {
  return ref.watch(workflowRepositoryProvider).getWorkflow(id);
});

class WorkflowRunsQuery {
  const WorkflowRunsQuery(this.workflowId, {this.page = 1, this.limit = 20, this.status});

  final String workflowId;
  final int page;
  final int limit;
  final String? status;

  @override
  bool operator ==(Object other) {
    return other is WorkflowRunsQuery &&
        other.workflowId == workflowId &&
        other.page == page &&
        other.limit == limit &&
        other.status == status;
  }

  @override
  int get hashCode => Object.hash(workflowId, page, limit, status);
}

final workflowRunsProvider =
    FutureProvider.family<PaginatedWorkflowResult<WorkflowRun>, WorkflowRunsQuery>((ref, query) {
  return ref
      .watch(workflowRepositoryProvider)
      .listRuns(query.workflowId, page: query.page, limit: query.limit, status: query.status);
});

final workflowMetricsProvider = FutureProvider.family<WorkflowMetrics, String>((ref, workflowId) {
  return ref.watch(workflowRepositoryProvider).getMetrics(workflowId);
});

final workflowHealthProvider = FutureProvider.family<WorkflowHealth, String>((ref, workflowId) {
  return ref.watch(workflowRepositoryProvider).getHealth(workflowId);
});

final workflowRunLogsProvider =
    FutureProvider.family<PaginatedWorkflowResult<WorkflowLog>, String>((ref, runId) {
  return ref.watch(workflowRepositoryProvider).listRunLogs(runId, page: 1, limit: 50);
});

final workflowStatusFilterProvider = StateProvider<String?>((ref) => null);

final workflowApprovalsPageProvider = StateProvider<int>((ref) => 1);

final workflowApprovalsProvider =
    FutureProvider.family<PaginatedWorkflowResult<WorkflowApproval>, int>((ref, page) {
  return ref.watch(workflowRepositoryProvider).listApprovals(page: page, limit: 20);
});

class WorkflowApprovalActionState {
  const WorkflowApprovalActionState({this.isLoading = false, this.errorMessage, this.actionApprovalId});

  final bool isLoading;
  final String? errorMessage;
  final String? actionApprovalId;

  WorkflowApprovalActionState copyWith({
    bool? isLoading,
    String? errorMessage,
    String? actionApprovalId,
  }) {
    return WorkflowApprovalActionState(
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage,
      actionApprovalId: actionApprovalId ?? this.actionApprovalId,
    );
  }
}

class WorkflowApprovalActionController extends StateNotifier<WorkflowApprovalActionState> {
  WorkflowApprovalActionController(this._ref) : super(const WorkflowApprovalActionState());

  final Ref _ref;

  Future<void> decide(String approvalId, {required String decision, String? comment}) async {
    state = state.copyWith(isLoading: true, actionApprovalId: approvalId, errorMessage: null);
    try {
      await _ref
          .read(workflowRepositoryProvider)
          .decideApproval(approvalId, decision: decision, comment: comment);
      _ref.invalidate(workflowApprovalsProvider);
      state = state.copyWith(isLoading: false);
    } catch (error) {
      state = state.copyWith(isLoading: false, errorMessage: error.toString());
    }
  }

  void clearError() => state = state.copyWith(errorMessage: null);
}

final workflowApprovalActionControllerProvider =
    StateNotifierProvider<WorkflowApprovalActionController, WorkflowApprovalActionState>((ref) {
  return WorkflowApprovalActionController(ref);
});

/// Drives run/pause/resume/cancel/retry mutations with a loading flag and
/// error surface, and invalidates the affected list/detail providers on
/// success so the UI reflects the new state immediately.
class WorkflowActionState {
  const WorkflowActionState({this.isLoading = false, this.errorMessage, this.actionWorkflowId});

  final bool isLoading;
  final String? errorMessage;
  final String? actionWorkflowId;

  WorkflowActionState copyWith({bool? isLoading, String? errorMessage, String? actionWorkflowId}) {
    return WorkflowActionState(
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage,
      actionWorkflowId: actionWorkflowId ?? this.actionWorkflowId,
    );
  }
}

class WorkflowActionController extends StateNotifier<WorkflowActionState> {
  WorkflowActionController(this._ref) : super(const WorkflowActionState());

  final Ref _ref;

  WorkflowRepository get _repository => _ref.read(workflowRepositoryProvider);

  Future<void> run(String workflowId) => _wrap(workflowId, () => _repository.runWorkflow(workflowId));

  Future<void> pause(String runId, {required String workflowId}) =>
      _wrap(workflowId, () => _repository.pauseRun(runId));

  Future<void> resume(String runId, {required String workflowId}) =>
      _wrap(workflowId, () => _repository.resumeRun(runId));

  Future<void> cancel(String runId, {required String workflowId}) =>
      _wrap(workflowId, () => _repository.cancelRun(runId));

  Future<void> retry(String runId, {required String workflowId}) =>
      _wrap(workflowId, () => _repository.retryRun(runId));

  Future<void> publish(String workflowId) =>
      _wrap(workflowId, () => _repository.publishWorkflow(workflowId));

  Future<void> archive(String workflowId) =>
      _wrap(workflowId, () => _repository.archiveWorkflow(workflowId));

  Future<void> _wrap(String workflowId, Future<void> Function() action) async {
    state = state.copyWith(isLoading: true, actionWorkflowId: workflowId, errorMessage: null);
    try {
      await action();
      _ref.invalidate(workflowsProvider);
      _ref.invalidate(workflowDetailProvider(workflowId));
      _ref.invalidate(workflowMetricsProvider(workflowId));
      state = state.copyWith(isLoading: false);
    } catch (error) {
      state = state.copyWith(isLoading: false, errorMessage: error.toString());
    }
  }

  void clearError() => state = state.copyWith(errorMessage: null);
}

final workflowActionControllerProvider =
    StateNotifierProvider<WorkflowActionController, WorkflowActionState>((ref) {
  return WorkflowActionController(ref);
});
