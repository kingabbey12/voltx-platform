import '../../../../core/network/api_client.dart';
import '../../../../core/network/network_exception.dart';
import '../models/workflow_models.dart';

class WorkflowApiService {
  WorkflowApiService(this._apiClient);

  final ApiClient _apiClient;

  Future<PaginatedWorkflowResult<Workflow>> listWorkflows(WorkflowPageQuery query) {
    return _apiClient.get(
      '/workflows',
      queryParameters: query.toQueryParameters(),
      fromJson: (json) => PaginatedWorkflowResult.fromJson(json, Workflow.fromJson),
    );
  }

  Future<Workflow> getWorkflow(String id) {
    return _apiClient.get('/workflows/$id', fromJson: Workflow.fromJson);
  }

  Future<Workflow> publishWorkflow(String id) {
    return _apiClient.post('/workflows/$id/publish', fromJson: Workflow.fromJson);
  }

  Future<Workflow> archiveWorkflow(String id) {
    return _apiClient.post('/workflows/$id/archive', fromJson: Workflow.fromJson);
  }

  Future<WorkflowRun> runWorkflow(String workflowId, {Map<String, dynamic>? input}) {
    return _apiClient.post(
      '/workflows/$workflowId/run',
      data: {'input': ?input},
      fromJson: WorkflowRun.fromJson,
    );
  }

  Future<PaginatedWorkflowResult<WorkflowRun>> listRuns(
    String workflowId, {
    required int page,
    required int limit,
    String? status,
  }) {
    return _apiClient.get(
      '/workflows/$workflowId/runs',
      queryParameters: {
        'page': page,
        'limit': limit,
        'status': ?status,
      },
      fromJson: (json) => PaginatedWorkflowResult.fromJson(json, WorkflowRun.fromJson),
    );
  }

  Future<WorkflowRun> getRun(String runId) {
    return _apiClient.get('/workflows/runs/$runId', fromJson: WorkflowRun.fromJson);
  }

  Future<WorkflowRun> pauseRun(String runId) {
    return _apiClient.post('/workflows/runs/$runId/pause', fromJson: WorkflowRun.fromJson);
  }

  Future<WorkflowRun> resumeRun(String runId) {
    return _apiClient.post('/workflows/runs/$runId/resume', fromJson: WorkflowRun.fromJson);
  }

  Future<WorkflowRun> cancelRun(String runId) {
    return _apiClient.post('/workflows/runs/$runId/cancel', fromJson: WorkflowRun.fromJson);
  }

  Future<WorkflowRun> retryRun(String runId) {
    return _apiClient.post('/workflows/runs/$runId/retry', fromJson: WorkflowRun.fromJson);
  }

  Future<PaginatedWorkflowResult<WorkflowLog>> listRunLogs(
    String runId, {
    required int page,
    required int limit,
  }) {
    return _apiClient.get(
      '/workflows/runs/$runId/logs',
      queryParameters: {'page': page, 'limit': limit},
      fromJson: (json) => PaginatedWorkflowResult.fromJson(json, WorkflowLog.fromJson),
    );
  }

  Future<WorkflowMetrics> getMetrics(String workflowId) {
    return _apiClient.get('/workflows/$workflowId/metrics', fromJson: WorkflowMetrics.fromJson);
  }

  Future<WorkflowHealth> getHealth(String workflowId) {
    return _apiClient.get('/workflows/$workflowId/health', fromJson: WorkflowHealth.fromJson);
  }

  Future<PaginatedWorkflowResult<WorkflowApproval>> listApprovals({
    required int page,
    required int limit,
  }) {
    return _apiClient.get(
      '/workflows/approvals',
      queryParameters: {'page': page, 'limit': limit},
      fromJson: (json) => PaginatedWorkflowResult.fromJson(json, WorkflowApproval.fromJson),
    );
  }

  Future<WorkflowApproval> decideApproval(
    String approvalId, {
    required String decision,
    String? comment,
  }) {
    return _apiClient.post(
      '/workflows/approvals/$approvalId/decide',
      data: {'decision': decision, 'comment': ?comment},
      fromJson: WorkflowApproval.fromJson,
    );
  }
}

WorkflowException mapToWorkflowException(Object error) {
  if (error is WorkflowException) {
    return error;
  }
  if (error is NetworkException) {
    return WorkflowException(
      error.statusCode == null ? friendlyNetworkFailureMessage(error) : error.message,
    );
  }
  return const WorkflowException('Unable to complete workflow request.');
}

class WorkflowException implements Exception {
  const WorkflowException(this.message);

  final String message;

  @override
  String toString() => message;
}
