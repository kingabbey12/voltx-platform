import '../../../attachments/data/models/attachment_models.dart';

/// Available AI model option.
class AiModel {
  const AiModel({
    required this.id,
    required this.name,
    required this.description,
    required this.contextWindow,
    required this.costPer1kTokens,
  });

  final String id;
  final String name;
  final String description;
  final int contextWindow;
  final double costPer1kTokens;
}

/// Configurable AI agent persona.
class AiAgent {
  const AiAgent({
    required this.id,
    required this.name,
    required this.description,
    required this.iconName,
    required this.systemPrompt,
  });

  final String id;
  final String name;
  final String description;
  final String iconName;
  final String systemPrompt;
}

/// Knowledge base for RAG context.
class AiKnowledgeBase {
  const AiKnowledgeBase({
    required this.id,
    required this.name,
    required this.description,
    required this.documentCount,
    required this.lastSynced,
  });

  final String id;
  final String name;
  final String description;
  final int documentCount;
  final DateTime lastSynced;
}

/// Long-term memory record returned by the backend memory engine.
class AiMemory {
  const AiMemory({
    required this.id,
    required this.conversationId,
    required this.category,
    required this.importance,
    required this.content,
    required this.createdAt,
    required this.updatedAt,
    this.embeddingId,
    this.metadata = const {},
  });

  final String id;
  final String conversationId;
  final String category;
  final double importance;
  final String content;
  final String? embeddingId;
  final Map<String, dynamic> metadata;
  final DateTime createdAt;
  final DateTime updatedAt;
}

/// Conversation thread.
class AiConversation {
  const AiConversation({
    required this.id,
    required this.title,
    required this.preview,
    required this.updatedAt,
    required this.pinned,
    required this.messageCount,
  });

  final String id;
  final String title;
  final String preview;
  final DateTime updatedAt;
  final bool pinned;
  final int messageCount;
}

/// Chat message with optional attachments.
class AiMessage {
  const AiMessage({
    required this.id,
    required this.role,
    required this.content,
    required this.timestamp,
    this.knownAttachments = const [],
    this.isStreaming = false,
    this.streamedContent,
  });

  final String id;
  final AiMessageRole role;
  final String content;
  final DateTime timestamp;

  /// Full attachment objects for a just-sent message — already known
  /// client-side (from the upload queue) at send time, so this renders
  /// immediately with no extra network round trip. For historical
  /// messages loaded from the backend this is empty — see
  /// MessageAttachmentsRow, which falls back to looking attachments up by
  /// AI_MESSAGE reference using [id] instead.
  final List<RemoteAttachment> knownAttachments;
  final bool isStreaming;
  final String? streamedContent;

  String get displayContent => isStreaming ? (streamedContent ?? '') : content;

  bool get isUser => role == AiMessageRole.user;
  bool get isAssistant => role == AiMessageRole.assistant;

  AiMessage copyWith({
    String? content,
    String? streamedContent,
    bool? isStreaming,
    List<RemoteAttachment>? knownAttachments,
  }) {
    return AiMessage(
      id: id,
      role: role,
      content: content ?? this.content,
      timestamp: timestamp,
      knownAttachments: knownAttachments ?? this.knownAttachments,
      isStreaming: isStreaming ?? this.isStreaming,
      streamedContent: streamedContent ?? this.streamedContent,
    );
  }
}

enum AiMessageRole { user, assistant, system }

/// Tool execution status for agent actions.
class AiToolExecution {
  const AiToolExecution({
    required this.id,
    required this.toolName,
    required this.status,
    required this.output,
  });

  final String id;
  final String toolName;
  final AiToolStatus status;
  final String output;

  AiToolExecution copyWith({AiToolStatus? status, String? output}) {
    return AiToolExecution(
      id: id,
      toolName: toolName,
      status: status ?? this.status,
      output: output ?? this.output,
    );
  }
}

enum AiToolStatus { running, completed, failed }

/// Suggested prompt chip.
class SuggestedPrompt {
  const SuggestedPrompt({
    required this.id,
    required this.label,
    required this.prompt,
    required this.iconName,
  });

  final String id;
  final String label;
  final String prompt;
  final String iconName;
}

/// Real per-agent usage stats (tool count, run history) — GET /ai/agents/:id/stats.
class AgentStats {
  const AgentStats({
    required this.agentId,
    required this.toolCount,
    required this.totalRunCount,
    required this.succeededRunCount,
    required this.lastRunAt,
  });

  final String agentId;
  final int toolCount;
  final int totalRunCount;
  final int succeededRunCount;
  final DateTime? lastRunAt;

  double? get successRate => totalRunCount == 0 ? null : succeededRunCount / totalRunCount;
}

/// One AI agent run, as executed via the multi-agent/autonomous runtime.
class AgentRun {
  const AgentRun({
    required this.id,
    required this.agentId,
    required this.conversationId,
    required this.status,
    required this.outputText,
    required this.toolCallCount,
    required this.startedAt,
    required this.completedAt,
    required this.error,
  });

  final String id;
  final String agentId;
  final String conversationId;
  final String status;
  final String? outputText;
  final int toolCallCount;
  final DateTime startedAt;
  final DateTime? completedAt;
  final String? error;
}

/// Human decision required before a mutating AI tool call proceeds.
class AgentApproval {
  const AgentApproval({
    required this.id,
    required this.agentRunId,
    required this.toolName,
    required this.input,
    required this.status,
    required this.createdAt,
  });

  final String id;
  final String agentRunId;
  final String toolName;
  final Map<String, dynamic> input;
  final String status;
  final DateTime createdAt;
}

/// Org-wide AI cost/usage rollup for a single agent, over the dashboard's lookback window.
class AgentPerformanceEntry {
  const AgentPerformanceEntry({
    required this.agentId,
    required this.agentName,
    required this.callCount,
    required this.totalTokens,
    required this.totalCostUsd,
  });

  final String? agentId;
  final String? agentName;
  final int callCount;
  final int totalTokens;
  final double totalCostUsd;
}

/// AI dashboard performance summary — GET /ai/dashboard/performance.
class AiPerformanceSummary {
  const AiPerformanceSummary({
    required this.lookbackDays,
    required this.totalCallCount,
    required this.totalTokens,
    required this.totalCostUsd,
    required this.byAgent,
  });

  final int lookbackDays;
  final int totalCallCount;
  final int totalTokens;
  final double totalCostUsd;
  final List<AgentPerformanceEntry> byAgent;
}

/// AI dashboard tasks summary — GET /ai/dashboard/tasks.
class AiTasksSummary {
  const AiTasksSummary({
    required this.pendingApprovals,
    required this.inProgressRuns,
  });

  final List<AgentApproval> pendingApprovals;
  final List<AgentRun> inProgressRuns;
}

/// Proactive AI-generated suggestion shown on the dashboard.
class AiSuggestion {
  const AiSuggestion({
    required this.id,
    required this.category,
    required this.title,
    required this.description,
    required this.createdAt,
  });

  final String id;
  final String category;
  final String title;
  final String description;
  final DateTime createdAt;
}
