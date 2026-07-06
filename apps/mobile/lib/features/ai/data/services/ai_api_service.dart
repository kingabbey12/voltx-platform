import 'package:dio/dio.dart';

import '../../../../core/network/api_client.dart';
import '../../../../core/network/network_exception.dart';
import '../../../../core/network/sse_client.dart';
import '../models/ai_models.dart';
import '../models/ai_stream_events.dart';

class AiApiService {
  AiApiService(this._apiClient, this._sseClient);

  final ApiClient _apiClient;
  final SseClient _sseClient;

  Future<List<AiAgent>> listAgents() async {
    try {
      final agents = await _apiClient.getList(
        '/ai/agents',
        fromJson: _agentFromJson,
      );
      return agents;
    } catch (error) {
      throw mapToAiException(error);
    }
  }

  Future<List<AiConversation>> listConversations({
    int page = 1,
    int limit = 20,
    String? search,
    bool? pinned,
    bool? archived,
  }) async {
    try {
      final queryParameters = <String, dynamic>{
        'page': page,
        'limit': limit,
      };
      if (search?.trim().isNotEmpty ?? false) {
        queryParameters['search'] = search!.trim();
      }
      if (pinned != null) {
        queryParameters['pinned'] = pinned;
      }
      if (archived != null) {
        queryParameters['archived'] = archived;
      }

      final pageResult = await _apiClient.get(
        '/ai/conversations',
        queryParameters: queryParameters,
        fromJson: PaginatedConversationsResponse.fromJson,
      );
      final conversations = pageResult.items;
      final previews = await Future.wait(
        conversations.map((conversation) async {
          final messagesPage = await _listMessagesPage(conversation.id, limit: 1);
          final preview = messagesPage.items.isEmpty
              ? 'No messages yet'
              : _preview(_messageFromJson(messagesPage.items.first).displayContent);
          return AiConversation(
            id: conversation.id,
            title: conversation.title,
            preview: preview,
            updatedAt: DateTime.tryParse(conversation.updatedAt) ?? DateTime.now(),
            pinned: conversation.pinned,
            messageCount: messagesPage.total,
          );
        }),
      );
      return previews;
    } catch (error) {
      throw mapToAiException(error);
    }
  }

  Future<AiConversation?> getConversation(String id) async {
    try {
      final conversation = await _apiClient.get(
        '/ai/conversations/$id',
        fromJson: _conversationFromJson,
      );
      final messagesPage = await _listMessagesPage(id, limit: 1);
      return AiConversation(
        id: conversation.id,
        title: conversation.title,
        preview: messagesPage.items.isEmpty
            ? 'No messages yet'
            : _preview(_messageFromJson(messagesPage.items.first).displayContent),
        updatedAt: DateTime.tryParse(conversation.updatedAt) ?? DateTime.now(),
        pinned: conversation.pinned,
        messageCount: messagesPage.total,
      );
    } catch (error) {
      throw mapToAiException(error);
    }
  }

  Future<List<AiMessage>> listMessages(String conversationId, {int page = 1, int limit = 50}) async {
    try {
      final pageResult = await _listMessagesPage(conversationId, page: page, limit: limit);
      return pageResult.items.map(_messageFromJson).toList();
    } catch (error) {
      throw mapToAiException(error);
    }
  }

  Future<PaginatedMessagesResponse> _listMessagesPage(
    String conversationId, {
    int page = 1,
    int limit = 50,
  }) {
    return _apiClient.get(
      '/ai/conversations/$conversationId/messages',
      queryParameters: {'page': page, 'limit': limit},
      fromJson: PaginatedMessagesResponse.fromJson,
    );
  }

  Future<AiConversation> createConversation({
    String? title,
    bool pinned = false,
    bool archived = false,
  }) async {
    try {
      final conversation = await _apiClient.post(
        '/ai/conversations',
        data: {
          if (title != null && title.trim().isNotEmpty) 'title': title.trim(),
          'pinned': pinned,
          'archived': archived,
        },
        fromJson: _conversationFromJson,
      );
      return AiConversation(
        id: conversation.id,
        title: conversation.title,
        preview: 'No messages yet',
        updatedAt: DateTime.tryParse(conversation.updatedAt) ?? DateTime.now(),
        pinned: conversation.pinned,
        messageCount: 0,
      );
    } catch (error) {
      throw mapToAiException(error);
    }
  }

  Future<({AiMessage userMessage, List<AiMessage> toolMessages, AiMessage? assistantMessage})>
      createMessage(
    String conversationId, {
    required String content,
    String? systemPrompt,
    List<String> workspaceContext = const [],
    List<AiToolExecutionResult> toolResults = const [],
    double? temperature,
    int? maxOutputTokens,
  }) async {
    try {
      final data = <String, dynamic>{
        'content': content,
      };
      if (systemPrompt != null && systemPrompt.trim().isNotEmpty) {
        data['systemPrompt'] = systemPrompt.trim();
      }
      if (workspaceContext.isNotEmpty) {
        data['workspaceContext'] = workspaceContext;
      }
      if (toolResults.isNotEmpty) {
        data['toolResults'] = toolResults.map(_toolResultPayload).toList();
      }
      if (temperature != null) {
        data['temperature'] = temperature;
      }
      if (maxOutputTokens != null) {
        data['maxOutputTokens'] = maxOutputTokens;
      }

      final response = await _apiClient.post(
        '/ai/conversations/$conversationId/messages',
        data: data,
        fromJson: CreateConversationMessageResponse.fromJson,
      );

      return (
        userMessage: _messageFromJson(response.userMessage),
        toolMessages: response.toolMessages.map(_messageFromJson).toList(),
        assistantMessage: response.assistantMessage != null
            ? _messageFromJson(response.assistantMessage!)
            : null,
      );
    } catch (error) {
      throw mapToAiException(error);
    }
  }

  /// Real-time token-by-token streaming via the backend's
  /// `writeGatewayEventStreamToResponse` SSE transport — the same
  /// `content_delta`/`message_end`/`tool_call_*`/`error` wire contract
  /// used by every AI streaming endpoint in the platform.
  Stream<AiChatStreamEvent> streamMessage(
    String conversationId, {
    required String content,
    String? systemPrompt,
    List<String> workspaceContext = const [],
    double? temperature,
    int? maxOutputTokens,
    CancelToken? cancelToken,
  }) {
    final data = <String, dynamic>{'content': content};
    if (systemPrompt != null && systemPrompt.trim().isNotEmpty) {
      data['systemPrompt'] = systemPrompt.trim();
    }
    if (workspaceContext.isNotEmpty) {
      data['workspaceContext'] = workspaceContext;
    }
    if (temperature != null) {
      data['temperature'] = temperature;
    }
    if (maxOutputTokens != null) {
      data['maxOutputTokens'] = maxOutputTokens;
    }

    final events = _sseClient.post(
      '/ai/conversations/$conversationId/messages/stream',
      data: data,
      cancelToken: cancelToken,
    );

    return events.map((event) {
      switch (event.event) {
        case 'content_delta':
          return AiContentDeltaEvent(event.data['delta'] as String? ?? '');
        case 'message_end':
          return AiMessageEndEvent(outputText: event.data['outputText'] as String?);
        case 'tool_call_start':
          return AiToolCallStartEvent(event.data['toolName'] as String? ?? 'tool');
        case 'tool_call_result':
          return AiToolCallResultEvent(
            event.data['toolName'] as String? ?? 'tool',
            event.data['durationMs'] as int? ?? 0,
          );
        case 'tool_call_error':
          return AiToolCallErrorEvent(
            event.data['toolName'] as String? ?? 'tool',
            event.data['message'] as String? ?? 'Tool call failed',
          );
        default:
          return AiStreamUnhandledEvent(event.event);
      }
    });
  }

  Future<List<AiMemory>> listMemories({
    int page = 1,
    int limit = 20,
    String? category,
    String? conversationId,
  }) async {
    try {
      final queryParameters = <String, dynamic>{
        'page': page,
        'limit': limit,
      };
      if (category?.trim().isNotEmpty ?? false) {
        queryParameters['category'] = category!.trim();
      }
      if (conversationId?.trim().isNotEmpty ?? false) {
        queryParameters['conversationId'] = conversationId!.trim();
      }

      final memoriesPage = await _apiClient.get(
        '/ai/memories',
        queryParameters: queryParameters,
        fromJson: PaginatedMemoriesResponse.fromJson,
      );
      return memoriesPage.items.map(_memoryFromJson).toList();
    } catch (error) {
      throw mapToAiException(error);
    }
  }

  Future<List<AiToolDescriptor>> listTools() async {
    try {
      return await _apiClient.getList(
        '/ai/tools',
        fromJson: _toolFromJson,
      );
    } catch (error) {
      throw mapToAiException(error);
    }
  }
}

class AiToolDescriptor {
  const AiToolDescriptor({
    required this.name,
    required this.description,
    required this.inputSchema,
    this.defaultTimeoutMs,
    this.defaultRetries,
  });

  final String name;
  final String description;
  final Map<String, dynamic> inputSchema;
  final int? defaultTimeoutMs;
  final int? defaultRetries;
}

class AiToolExecutionResult {
  const AiToolExecutionResult({
    required this.toolName,
    required this.content,
    this.isError,
  });

  final String toolName;
  final String content;
  final bool? isError;
}

class PaginatedConversationsResponse {
  const PaginatedConversationsResponse({
    required this.items,
    required this.total,
    required this.page,
    required this.limit,
    required this.totalPages,
  });

  final List<AiConversationRecord> items;
  final int total;
  final int page;
  final int limit;
  final int totalPages;

  factory PaginatedConversationsResponse.fromJson(Map<String, dynamic> json) {
    return PaginatedConversationsResponse(
      items: (json['items'] as List<dynamic>? ?? const [])
          .map((item) => AiConversationRecord.fromJson(Map<String, dynamic>.from(item as Map)))
          .toList(),
      total: json['total'] as int? ?? 0,
      page: json['page'] as int? ?? 1,
      limit: json['limit'] as int? ?? 20,
      totalPages: json['totalPages'] as int? ?? 1,
    );
  }
}

class PaginatedMessagesResponse {
  const PaginatedMessagesResponse({
    required this.items,
    required this.total,
    required this.page,
    required this.limit,
    required this.totalPages,
  });

  final List<AiMessageRecord> items;
  final int total;
  final int page;
  final int limit;
  final int totalPages;

  factory PaginatedMessagesResponse.fromJson(Map<String, dynamic> json) {
    return PaginatedMessagesResponse(
      items: (json['items'] as List<dynamic>? ?? const [])
          .map((item) => AiMessageRecord.fromJson(Map<String, dynamic>.from(item as Map)))
          .toList(),
      total: json['total'] as int? ?? 0,
      page: json['page'] as int? ?? 1,
      limit: json['limit'] as int? ?? 50,
      totalPages: json['totalPages'] as int? ?? 1,
    );
  }
}

class PaginatedMemoriesResponse {
  const PaginatedMemoriesResponse({
    required this.items,
    required this.total,
    required this.page,
    required this.limit,
    required this.totalPages,
  });

  final List<AiMemoryRecord> items;
  final int total;
  final int page;
  final int limit;
  final int totalPages;

  factory PaginatedMemoriesResponse.fromJson(Map<String, dynamic> json) {
    return PaginatedMemoriesResponse(
      items: (json['items'] as List<dynamic>? ?? const [])
          .map((item) => AiMemoryRecord.fromJson(Map<String, dynamic>.from(item as Map)))
          .toList(),
      total: json['total'] as int? ?? 0,
      page: json['page'] as int? ?? 1,
      limit: json['limit'] as int? ?? 20,
      totalPages: json['totalPages'] as int? ?? 1,
    );
  }
}

class CreateConversationMessageResponse {
  const CreateConversationMessageResponse({
    required this.userMessage,
    required this.toolMessages,
    required this.assistantMessage,
  });

  final AiMessageRecord userMessage;
  final List<AiMessageRecord> toolMessages;
  final AiMessageRecord? assistantMessage;

  factory CreateConversationMessageResponse.fromJson(Map<String, dynamic> json) {
    return CreateConversationMessageResponse(
      userMessage: AiMessageRecord.fromJson(Map<String, dynamic>.from(json['userMessage'] as Map)),
      toolMessages: (json['toolMessages'] as List<dynamic>? ?? const [])
          .map((item) => AiMessageRecord.fromJson(Map<String, dynamic>.from(item as Map)))
          .toList(),
      assistantMessage: json['assistantMessage'] == null
          ? null
          : AiMessageRecord.fromJson(Map<String, dynamic>.from(json['assistantMessage'] as Map)),
    );
  }
}

class AiConversationRecord {
  const AiConversationRecord({
    required this.id,
    required this.title,
    required this.model,
    required this.provider,
    required this.pinned,
    required this.archived,
    required this.createdAt,
    required this.updatedAt,
  });

  factory AiConversationRecord.fromJson(Map<String, dynamic> json) {
    return AiConversationRecord(
      id: json['id'] as String,
      title: json['title'] as String? ?? 'New conversation',
      model: json['model'] as String? ?? '',
      provider: json['provider'] as String? ?? '',
      pinned: json['pinned'] as bool? ?? false,
      archived: json['archived'] as bool? ?? false,
      createdAt: json['createdAt'] as String? ?? DateTime.now().toIso8601String(),
      updatedAt: json['updatedAt'] as String? ?? DateTime.now().toIso8601String(),
    );
  }

  final String id;
  final String title;
  final String model;
  final String provider;
  final bool pinned;
  final bool archived;
  final String createdAt;
  final String updatedAt;
}

class AiMessageRecord {
  const AiMessageRecord({
    required this.id,
    required this.role,
    required this.content,
    required this.createdAt,
    this.metadata = const {},
  });

  factory AiMessageRecord.fromJson(Map<String, dynamic> json) {
    return AiMessageRecord(
      id: json['id'] as String,
      role: (json['role'] as String? ?? 'assistant').toLowerCase(),
      content: json['content'] as String? ?? '',
      createdAt: json['createdAt'] as String? ?? DateTime.now().toIso8601String(),
      metadata: json['metadata'] is Map
          ? Map<String, dynamic>.from(json['metadata'] as Map)
          : const {},
    );
  }

  final String id;
  final String role;
  final String content;
  final String createdAt;
  final Map<String, dynamic> metadata;
}

class AiMemoryRecord {
  const AiMemoryRecord({
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

  factory AiMemoryRecord.fromJson(Map<String, dynamic> json) {
    return AiMemoryRecord(
      id: json['id'] as String,
      conversationId: json['conversationId'] as String,
      category: json['category'] as String? ?? 'general',
      importance: (json['importance'] as num?)?.toDouble() ?? 0,
      content: json['content'] as String? ?? '',
      createdAt: json['createdAt'] as String? ?? DateTime.now().toIso8601String(),
      updatedAt: json['updatedAt'] as String? ?? DateTime.now().toIso8601String(),
      embeddingId: json['embeddingId'] as String?,
      metadata: json['metadata'] is Map
          ? Map<String, dynamic>.from(json['metadata'] as Map)
          : const {},
    );
  }

  final String id;
  final String conversationId;
  final String category;
  final double importance;
  final String content;
  final String createdAt;
  final String updatedAt;
  final String? embeddingId;
  final Map<String, dynamic> metadata;
}

AiMemory _memoryFromJson(AiMemoryRecord record) {
  return AiMemory(
    id: record.id,
    conversationId: record.conversationId,
    category: record.category,
    importance: record.importance,
    content: record.content,
    embeddingId: record.embeddingId,
    metadata: record.metadata,
    createdAt: DateTime.tryParse(record.createdAt) ?? DateTime.now(),
    updatedAt: DateTime.tryParse(record.updatedAt) ?? DateTime.now(),
  );
}

AiAgent _agentFromJson(Map<String, dynamic> json) {
  return AiAgent(
    id: json['id'] as String,
    name: json['name'] as String? ?? 'AI Agent',
    description: json['description'] as String? ?? '',
    iconName: _agentIconName(json),
    systemPrompt: json['systemPrompt'] as String? ?? '',
  );
}

AiConversationRecord _conversationFromJson(Map<String, dynamic> json) {
  return AiConversationRecord.fromJson(json);
}

AiMessage _messageFromJson(AiMessageRecord record) {
  return AiMessage(
    id: record.id,
    role: switch (record.role.toLowerCase()) {
      'user' => AiMessageRole.user,
      'system' => AiMessageRole.system,
      'tool' => AiMessageRole.system,
      _ => AiMessageRole.assistant,
    },
    content: record.content,
    timestamp: DateTime.tryParse(record.createdAt) ?? DateTime.now(),
  );
}

AiToolDescriptor _toolFromJson(Map<String, dynamic> json) {
  return AiToolDescriptor(
    name: json['name'] as String? ?? 'tool',
    description: json['description'] as String? ?? '',
    inputSchema: json['inputSchema'] is Map
        ? Map<String, dynamic>.from(json['inputSchema'] as Map)
        : const {},
    defaultTimeoutMs: json['defaultTimeoutMs'] as int?,
    defaultRetries: json['defaultRetries'] as int?,
  );
}

String _agentIconName(Map<String, dynamic> json) {
  final name = (json['name'] as String? ?? '').toLowerCase();
  final description = (json['description'] as String? ?? '').toLowerCase();
  final prompt = (json['systemPrompt'] as String? ?? '').toLowerCase();

  if (name.contains('compliance') || description.contains('compliance') || prompt.contains('compliance')) {
    return 'shield';
  }
  if (name.contains('build') || description.contains('maintenance') || prompt.contains('maintenance')) {
    return 'build';
  }
  if (name.contains('analysis') || description.contains('analysis') || prompt.contains('analy')) {
    return 'analytics';
  }
  return 'ai';
}

String _preview(String text) {
  final normalized = text.replaceAll(RegExp(r'\s+'), ' ').trim();
  if (normalized.length <= 72) {
    return normalized;
  }
  return '${normalized.substring(0, 69).trimRight()}...';
}

Map<String, dynamic> _toolResultPayload(AiToolExecutionResult tool) {
  final payload = <String, dynamic>{
    'toolName': tool.toolName,
    'content': tool.content,
  };
  if (tool.isError != null) {
    payload['isError'] = tool.isError;
  }
  return payload;
}

AiException mapToAiException(Object error) {
  if (error is AiException) {
    return error;
  }
  if (error is NetworkException) {
    return AiException(
      error.statusCode == null ? friendlyNetworkFailureMessage(error) : error.message,
    );
  }
  return const AiException('Unable to complete AI request.');
}

class AiException implements Exception {
  const AiException(this.message);

  final String message;

  @override
  String toString() => message;
}
