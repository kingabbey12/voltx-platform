class WorkflowPageQuery {
  const WorkflowPageQuery({
    this.page = 1,
    this.limit = 20,
    this.status,
    this.search,
  });

  final int page;
  final int limit;
  final String? status;
  final String? search;

  Map<String, dynamic> toQueryParameters() {
    return {
      'page': page,
      'limit': limit,
      if (status != null) 'status': status,
      if (search != null && search!.trim().isNotEmpty) 'search': search!.trim(),
    };
  }

  @override
  bool operator ==(Object other) {
    return other is WorkflowPageQuery &&
        other.page == page &&
        other.limit == limit &&
        other.status == status &&
        other.search == search;
  }

  @override
  int get hashCode => Object.hash(page, limit, status, search);
}

class PaginatedWorkflowResult<T> {
  const PaginatedWorkflowResult({
    required this.items,
    required this.total,
    required this.page,
    required this.limit,
    required this.totalPages,
  });

  final List<T> items;
  final int total;
  final int page;
  final int limit;
  final int totalPages;

  factory PaginatedWorkflowResult.fromJson(
    Map<String, dynamic> json,
    T Function(Map<String, dynamic> json) parser,
  ) {
    final items = (json['items'] as List<dynamic>? ?? const [])
        .map((item) => parser(Map<String, dynamic>.from(item as Map)))
        .toList();
    return PaginatedWorkflowResult<T>(
      items: items,
      total: json['total'] as int? ?? items.length,
      page: json['page'] as int? ?? 1,
      limit: json['limit'] as int? ?? items.length,
      totalPages: json['totalPages'] as int? ?? 1,
    );
  }
}

/// A published/draft workflow definition (the automation "template").
class Workflow {
  const Workflow({
    required this.id,
    required this.name,
    required this.status,
    required this.createdBy,
    required this.createdAt,
    required this.updatedAt,
    this.description,
    this.publishedVersion,
  });

  factory Workflow.fromJson(Map<String, dynamic> json) {
    return Workflow(
      id: json['id'] as String,
      name: json['name'] as String,
      description: json['description'] as String?,
      status: json['status'] as String? ?? 'DRAFT',
      publishedVersion: json['publishedVersion'] as int?,
      createdBy: json['createdBy'] as String,
      createdAt: json['createdAt'] as String,
      updatedAt: json['updatedAt'] as String,
    );
  }

  final String id;
  final String name;
  final String? description;
  final String status;
  final int? publishedVersion;
  final String createdBy;
  final String createdAt;
  final String updatedAt;

  bool get isPublished => status == 'PUBLISHED';
}

/// One execution of a [Workflow] — what "run history" shows.
class WorkflowRun {
  const WorkflowRun({
    required this.id,
    required this.workflowId,
    required this.status,
    required this.triggerType,
    required this.input,
    required this.context,
    required this.output,
    required this.version,
    required this.queuedAt,
    required this.createdAt,
    this.currentStepId,
    this.error,
    this.startedAt,
    this.completedAt,
    this.durationMs,
  });

  factory WorkflowRun.fromJson(Map<String, dynamic> json) {
    return WorkflowRun(
      id: json['id'] as String,
      workflowId: json['workflowId'] as String,
      status: json['status'] as String,
      triggerType: json['triggerType'] as String? ?? 'MANUAL',
      input: Map<String, dynamic>.from(json['input'] as Map? ?? const {}),
      context: Map<String, dynamic>.from(json['context'] as Map? ?? const {}),
      output: Map<String, dynamic>.from(json['output'] as Map? ?? const {}),
      currentStepId: json['currentStepId'] as String?,
      error: json['error'] as String?,
      version: json['version'] as int? ?? 0,
      startedAt: json['startedAt'] as String?,
      completedAt: json['completedAt'] as String?,
      durationMs: json['durationMs'] as int?,
      queuedAt: json['queuedAt'] as String,
      createdAt: json['createdAt'] as String,
    );
  }

  final String id;
  final String workflowId;
  final String status;
  final String triggerType;
  final Map<String, dynamic> input;
  final Map<String, dynamic> context;
  final Map<String, dynamic> output;
  final String? currentStepId;
  final String? error;
  final int version;
  final String? startedAt;
  final String? completedAt;
  final int? durationMs;
  final String queuedAt;
  final String createdAt;

  bool get isActive => status == 'RUNNING' || status == 'PENDING' || status == 'WAITING_APPROVAL';
  bool get isPaused => status == 'PAUSED';
  bool get isFailed => status == 'FAILED';
  bool get isSucceeded => status == 'SUCCEEDED';
}

class WorkflowMetrics {
  const WorkflowMetrics({
    required this.totalRuns,
    required this.succeededRuns,
    required this.failedRuns,
    required this.cancelledRuns,
    required this.successRate,
    required this.failureRate,
    required this.averageExecutionTimeMs,
    required this.averageQueueTimeMs,
    required this.totalRetries,
    required this.agentStepCount,
    required this.toolStepCount,
    required this.totalTokens,
    required this.totalCostUsd,
  });

  factory WorkflowMetrics.fromJson(Map<String, dynamic> json) {
    return WorkflowMetrics(
      totalRuns: json['totalRuns'] as int? ?? 0,
      succeededRuns: json['succeededRuns'] as int? ?? 0,
      failedRuns: json['failedRuns'] as int? ?? 0,
      cancelledRuns: json['cancelledRuns'] as int? ?? 0,
      successRate: (json['successRate'] as num?)?.toDouble() ?? 0,
      failureRate: (json['failureRate'] as num?)?.toDouble() ?? 0,
      averageExecutionTimeMs: (json['averageExecutionTimeMs'] as num?)?.toDouble() ?? 0,
      averageQueueTimeMs: (json['averageQueueTimeMs'] as num?)?.toDouble() ?? 0,
      totalRetries: json['totalRetries'] as int? ?? 0,
      agentStepCount: json['agentStepCount'] as int? ?? 0,
      toolStepCount: json['toolStepCount'] as int? ?? 0,
      totalTokens: json['totalTokens'] as int? ?? 0,
      totalCostUsd: (json['totalCostUsd'] as num?)?.toDouble() ?? 0,
    );
  }

  final int totalRuns;
  final int succeededRuns;
  final int failedRuns;
  final int cancelledRuns;
  final double successRate;
  final double failureRate;
  final double averageExecutionTimeMs;
  final double averageQueueTimeMs;
  final int totalRetries;
  final int agentStepCount;
  final int toolStepCount;
  final int totalTokens;
  final double totalCostUsd;
}

class WorkflowHealth {
  const WorkflowHealth({required this.healthy, required this.reasons});

  factory WorkflowHealth.fromJson(Map<String, dynamic> json) {
    return WorkflowHealth(
      healthy: json['healthy'] as bool? ?? false,
      reasons: (json['reasons'] as List<dynamic>? ?? const []).map((e) => e.toString()).toList(),
    );
  }

  final bool healthy;
  final List<String> reasons;
}

class WorkflowLog {
  const WorkflowLog({
    required this.id,
    required this.workflowRunId,
    required this.level,
    required this.event,
    required this.message,
    required this.metadata,
    required this.createdAt,
    this.stepRunId,
  });

  factory WorkflowLog.fromJson(Map<String, dynamic> json) {
    return WorkflowLog(
      id: json['id'] as String,
      workflowRunId: json['workflowRunId'] as String,
      stepRunId: json['stepRunId'] as String?,
      level: json['level'] as String,
      event: json['event'] as String,
      message: json['message'] as String,
      metadata: Map<String, dynamic>.from(json['metadata'] as Map? ?? const {}),
      createdAt: json['createdAt'] as String,
    );
  }

  final String id;
  final String workflowRunId;
  final String? stepRunId;
  final String level;
  final String event;
  final String message;
  final Map<String, dynamic> metadata;
  final String createdAt;
}
