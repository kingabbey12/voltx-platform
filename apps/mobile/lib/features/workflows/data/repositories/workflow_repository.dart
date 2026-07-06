import '../models/workflow_models.dart';
import '../services/workflow_api_service.dart';

abstract class WorkflowRepository {
  Future<PaginatedWorkflowResult<Workflow>> listWorkflows(WorkflowPageQuery query);
  Future<Workflow> getWorkflow(String id);
  Future<Workflow> publishWorkflow(String id);
  Future<Workflow> archiveWorkflow(String id);
  Future<WorkflowRun> runWorkflow(String workflowId, {Map<String, dynamic>? input});
  Future<PaginatedWorkflowResult<WorkflowRun>> listRuns(
    String workflowId, {
    required int page,
    required int limit,
    String? status,
  });
  Future<WorkflowRun> getRun(String runId);
  Future<WorkflowRun> pauseRun(String runId);
  Future<WorkflowRun> resumeRun(String runId);
  Future<WorkflowRun> cancelRun(String runId);
  Future<WorkflowRun> retryRun(String runId);
  Future<PaginatedWorkflowResult<WorkflowLog>> listRunLogs(
    String runId, {
    required int page,
    required int limit,
  });
  Future<WorkflowMetrics> getMetrics(String workflowId);
  Future<WorkflowHealth> getHealth(String workflowId);
}

class ApiWorkflowRepository implements WorkflowRepository {
  ApiWorkflowRepository(this._api);

  final WorkflowApiService _api;

  @override
  Future<PaginatedWorkflowResult<Workflow>> listWorkflows(WorkflowPageQuery query) async {
    try {
      return await _api.listWorkflows(query);
    } catch (error) {
      throw mapToWorkflowException(error);
    }
  }

  @override
  Future<Workflow> getWorkflow(String id) async {
    try {
      return await _api.getWorkflow(id);
    } catch (error) {
      throw mapToWorkflowException(error);
    }
  }

  @override
  Future<Workflow> publishWorkflow(String id) async {
    try {
      return await _api.publishWorkflow(id);
    } catch (error) {
      throw mapToWorkflowException(error);
    }
  }

  @override
  Future<Workflow> archiveWorkflow(String id) async {
    try {
      return await _api.archiveWorkflow(id);
    } catch (error) {
      throw mapToWorkflowException(error);
    }
  }

  @override
  Future<WorkflowRun> runWorkflow(String workflowId, {Map<String, dynamic>? input}) async {
    try {
      return await _api.runWorkflow(workflowId, input: input);
    } catch (error) {
      throw mapToWorkflowException(error);
    }
  }

  @override
  Future<PaginatedWorkflowResult<WorkflowRun>> listRuns(
    String workflowId, {
    required int page,
    required int limit,
    String? status,
  }) async {
    try {
      return await _api.listRuns(workflowId, page: page, limit: limit, status: status);
    } catch (error) {
      throw mapToWorkflowException(error);
    }
  }

  @override
  Future<WorkflowRun> getRun(String runId) async {
    try {
      return await _api.getRun(runId);
    } catch (error) {
      throw mapToWorkflowException(error);
    }
  }

  @override
  Future<WorkflowRun> pauseRun(String runId) async {
    try {
      return await _api.pauseRun(runId);
    } catch (error) {
      throw mapToWorkflowException(error);
    }
  }

  @override
  Future<WorkflowRun> resumeRun(String runId) async {
    try {
      return await _api.resumeRun(runId);
    } catch (error) {
      throw mapToWorkflowException(error);
    }
  }

  @override
  Future<WorkflowRun> cancelRun(String runId) async {
    try {
      return await _api.cancelRun(runId);
    } catch (error) {
      throw mapToWorkflowException(error);
    }
  }

  @override
  Future<WorkflowRun> retryRun(String runId) async {
    try {
      return await _api.retryRun(runId);
    } catch (error) {
      throw mapToWorkflowException(error);
    }
  }

  @override
  Future<PaginatedWorkflowResult<WorkflowLog>> listRunLogs(
    String runId, {
    required int page,
    required int limit,
  }) async {
    try {
      return await _api.listRunLogs(runId, page: page, limit: limit);
    } catch (error) {
      throw mapToWorkflowException(error);
    }
  }

  @override
  Future<WorkflowMetrics> getMetrics(String workflowId) async {
    try {
      return await _api.getMetrics(workflowId);
    } catch (error) {
      throw mapToWorkflowException(error);
    }
  }

  @override
  Future<WorkflowHealth> getHealth(String workflowId) async {
    try {
      return await _api.getHealth(workflowId);
    } catch (error) {
      throw mapToWorkflowException(error);
    }
  }
}
