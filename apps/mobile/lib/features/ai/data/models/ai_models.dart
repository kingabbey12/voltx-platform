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
