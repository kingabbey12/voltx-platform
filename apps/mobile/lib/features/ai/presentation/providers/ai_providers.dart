import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/analytics/analytics_service.dart';
import '../../../../core/network/network_providers.dart';
import '../../../attachments/data/models/attachment_models.dart';
import '../../../knowledge/data/models/knowledge_models.dart';
import '../../../knowledge/data/repositories/knowledge_repository.dart';
import '../../../knowledge/presentation/providers/knowledge_providers.dart';
import '../../data/catalog/ai_static_catalog.dart';
import '../../data/mock/mock_ai_data.dart';
import '../../data/models/ai_models.dart';
import '../../data/models/ai_stream_events.dart';
import '../../data/services/ai_api_service.dart';

/// Maps icon name strings to Material icons.
IconData aiIcon(String name) {
  return switch (name) {
    'analytics' => Icons.analytics_outlined,
    'build' => Icons.build_outlined,
    'shield' => Icons.shield_outlined,
    'alert' => Icons.warning_amber_rounded,
    'doc' => Icons.description_outlined,
    'chart' => Icons.show_chart_rounded,
    'ai' => Icons.auto_awesome_rounded,
    'file' => Icons.insert_drive_file_outlined,
    'image' => Icons.image_outlined,
    _ => Icons.circle_outlined,
  };
}

final aiApiServiceProvider = Provider<AiApiService>((ref) {
  return AiApiService(ref.watch(apiClientProvider), ref.watch(sseClientProvider));
});

bool _hasFlutterBinding() {
  try {
    WidgetsBinding.instance;
    return true;
  } catch (_) {
    return false;
  }
}

// --- Selection providers ---

final selectedModelProvider = StateProvider<AiModel>(
  (ref) => AiStaticCatalog.models.first,
);

/// Seeded with an empty placeholder — corrected to the first real agent
/// the instant `AiAgentsNotifier` loads the live `/ai/agents` list (see
/// its constructor). Never rendered for more than one frame in practice.
final selectedAgentProvider = StateProvider<AiAgent>(
  (ref) => const AiAgent(id: '', name: 'Loading…', description: '', iconName: 'ai', systemPrompt: ''),
);

/// Seeded with an empty placeholder — corrected to the first real
/// knowledge source once `AiKnowledgeBasesNotifier` loads
/// `/knowledge/sources`.
final selectedKnowledgeProvider = StateProvider<AiKnowledgeBase>(
  (ref) => AiKnowledgeBase(id: '', name: 'Loading…', description: '', documentCount: 0, lastSynced: DateTime.now()),
);

final activeConversationIdProvider = StateProvider<String>(
  (ref) => '',
);

// --- Conversation list ---

final conversationSearchProvider = StateProvider<String>((ref) => '');

class AiAgentsNotifier extends StateNotifier<List<AiAgent>> {
  AiAgentsNotifier(this._ref, this._api) : super(const []) {
    if (!_hasFlutterBinding()) {
      state = List.of(MockAiData.agents);
      return;
    }
    unawaited(_load());
  }

  final Ref _ref;
  final AiApiService _api;

  Future<void> _load() async {
    try {
      final agents = await _api.listAgents();
      state = agents;
      if (agents.isNotEmpty) {
        final current = _ref.read(selectedAgentProvider);
        if (!agents.any((agent) => agent.id == current.id)) {
          _ref.read(selectedAgentProvider.notifier).state = agents.first;
        }
      }
    } catch (_) {
      state = const [];
    }
  }
}

class AiConversationsNotifier extends StateNotifier<List<AiConversation>> {
  AiConversationsNotifier(this._ref, this._api) : super(const []) {
    if (!_hasFlutterBinding()) {
      state = List.of(MockAiData.conversations);
      return;
    }
    unawaited(_load());
  }

  final Ref _ref;
  final AiApiService _api;

  Future<void> _load() async {
    try {
      final conversations = await _api.listConversations();
      state = conversations;
      if (conversations.isNotEmpty) {
        final activeId = _ref.read(activeConversationIdProvider);
        if (activeId.isEmpty || !conversations.any((conversation) => conversation.id == activeId)) {
          _ref.read(activeConversationIdProvider.notifier).state = conversations.first.id;
        }
      }
    } catch (_) {
      state = const [];
    }
  }

  Future<void> reload() => _load();

  void prepend(AiConversation conversation) {
    state = [
      conversation,
      for (final item in state)
        if (item.id != conversation.id) item,
    ];
  }
}

/// Backs the lightweight "attach knowledge source as chat context"
/// selector (`ai_context_sheet.dart`, `ai_selectors.dart`). Sources real
/// `KnowledgeSource` records from `/knowledge/sources` (VT-023) — the
/// dedicated Knowledge Graph screen (`ai_knowledge_screen.dart`) reads the
/// same backend data directly via `knowledgeSourcesProvider` for its
/// richer view; this notifier just adapts the same real sources into the
/// simpler `AiKnowledgeBase` shape this selector widget expects.
class AiKnowledgeBasesNotifier extends StateNotifier<List<AiKnowledgeBase>> {
  AiKnowledgeBasesNotifier(this._ref, this._repository) : super(const []) {
    if (!_hasFlutterBinding()) {
      state = List.of(MockAiData.knowledgeBases);
      return;
    }
    unawaited(_load());
  }

  final Ref _ref;
  final KnowledgeRepository _repository;

  Future<void> _load() async {
    try {
      final page = await _repository.listSources(const KnowledgePageQuery(limit: 100));
      final knowledgeBases = page.items.map(_toAiKnowledgeBase).toList();
      state = knowledgeBases;
      if (knowledgeBases.isNotEmpty) {
        final current = _ref.read(selectedKnowledgeProvider);
        if (!knowledgeBases.any((item) => item.id == current.id)) {
          _ref.read(selectedKnowledgeProvider.notifier).state = knowledgeBases.first;
        }
      }
    } catch (_) {
      state = const [];
    }
  }

  AiKnowledgeBase _toAiKnowledgeBase(KnowledgeSource source) {
    return AiKnowledgeBase(
      id: source.id,
      name: source.name,
      description: source.description ?? source.type,
      documentCount: 0,
      lastSynced: DateTime.tryParse(source.lastIndexedAt ?? '') ?? DateTime.tryParse(source.updatedAt) ?? DateTime.now(),
    );
  }
}

class AiToolsNotifier extends StateNotifier<List<AiToolDescriptor>> {
  AiToolsNotifier(this._api) : super(const []) {
    if (!_hasFlutterBinding()) {
      return;
    }
    unawaited(_load());
  }

  final AiApiService _api;

  Future<void> _load() async {
    try {
      state = await _api.listTools();
    } catch (_) {
      state = const [];
    }
  }
}

class AiMemoriesNotifier extends StateNotifier<List<AiMemory>> {
  AiMemoriesNotifier(this._api) : super(const []) {
    if (!_hasFlutterBinding()) {
      state = List.of(MockAiData.memories);
      return;
    }
    unawaited(_load());
  }

  final AiApiService _api;

  Future<void> _load() async {
    try {
      state = await _api.listMemories(limit: 100);
    } catch (_) {
      state = const [];
    }
  }

  Future<void> reload() => _load();
}

class AiMemoryTimelineEntry {
  const AiMemoryTimelineEntry({
    required this.title,
    required this.subtitle,
    required this.time,
  });

  final String title;
  final String subtitle;
  final String time;
}

class AiMemorySnapshot {
  const AiMemorySnapshot({
    required this.memories,
    required this.categoryCounts,
    required this.latestUpdatedAt,
    required this.recentHighlights,
    required this.timeline,
  });

  final List<AiMemory> memories;
  final Map<String, int> categoryCounts;
  final DateTime? latestUpdatedAt;
  final List<String> recentHighlights;
  final List<AiMemoryTimelineEntry> timeline;

  int get totalMemories => memories.length;

  String get freshnessLabel {
    final updatedAt = latestUpdatedAt;
    if (updatedAt == null) {
      return 'No memories synced';
    }
    final diff = DateTime.now().difference(updatedAt);
    if (diff.inMinutes < 60) {
      return '${diff.inMinutes}m ago';
    }
    if (diff.inHours < 24) {
      return '${diff.inHours}h ago';
    }
    return '${diff.inDays}d ago';
  }

  String get statusLabel {
    if (totalMemories == 0) {
      return 'Empty';
    }
    final categories = categoryCounts.length;
    return '$totalMemories memories · $categories categories';
  }

  factory AiMemorySnapshot.fromMemories(List<AiMemory> memories) {
    final ordered = List<AiMemory>.from(memories)
      ..sort((a, b) => b.updatedAt.compareTo(a.updatedAt));
    final counts = <String, int>{};
    for (final memory in ordered) {
      counts.update(memory.category.trim().isEmpty ? 'general' : memory.category.trim().toLowerCase(), (count) => count + 1, ifAbsent: () => 1);
    }
    final latest = ordered.isEmpty ? null : ordered.first.updatedAt;
    final highlights = List<String>.from(ordered
        .where((memory) => memory.importance >= 0.75)
        .take(3)
        .map((memory) => _memorySnippet(memory)));
    if (highlights.isEmpty && ordered.isNotEmpty) {
      highlights.addAll(ordered.take(3).map((memory) => _memorySnippet(memory)));
    }
    final timeline = ordered.take(5).map((memory) {
      return AiMemoryTimelineEntry(
        title: _titleCase(memory.category),
        subtitle: _memorySnippet(memory),
        time: _relativeTime(memory.updatedAt),
      );
    }).toList();
    return AiMemorySnapshot(
      memories: ordered,
      categoryCounts: counts,
      latestUpdatedAt: latest,
      recentHighlights: highlights,
      timeline: timeline,
    );
  }
}

final aiConversationsStoreProvider =
    StateNotifierProvider<AiConversationsNotifier, List<AiConversation>>((ref) {
  return AiConversationsNotifier(ref, ref.watch(aiApiServiceProvider));
});

final conversationsProvider = Provider<List<AiConversation>>((ref) {
  final query = ref.watch(conversationSearchProvider).trim().toLowerCase();
  var list = List<AiConversation>.from(ref.watch(aiConversationsStoreProvider));
  list.sort((a, b) {
    if (a.pinned != b.pinned) {
      return a.pinned ? -1 : 1;
    }
    return b.updatedAt.compareTo(a.updatedAt);
  });
  if (query.isEmpty) {
    return list;
  }
  return list
      .where(
        (c) =>
            c.title.toLowerCase().contains(query) ||
            c.preview.toLowerCase().contains(query),
      )
      .toList();
});

final pinnedConversationsProvider = Provider<List<AiConversation>>((ref) {
  return ref.watch(conversationsProvider).where((c) => c.pinned).toList();
});

// --- Chat state ---

class AiChatState {
  const AiChatState({
    this.messages = const [],
    this.isStreaming = false,
    this.tokensUsed = 0,
    this.activeTool,
  });

  final List<AiMessage> messages;
  final bool isStreaming;
  final int tokensUsed;
  final AiToolExecution? activeTool;

  AiChatState copyWith({
    List<AiMessage>? messages,
    bool? isStreaming,
    int? tokensUsed,
    AiToolExecution? activeTool,
    bool clearTool = false,
  }) {
    return AiChatState(
      messages: messages ?? this.messages,
      isStreaming: isStreaming ?? this.isStreaming,
      tokensUsed: tokensUsed ?? this.tokensUsed,
      activeTool: clearTool ? null : (activeTool ?? this.activeTool),
    );
  }
}

class AiChatNotifier extends StateNotifier<AiChatState> {
  AiChatNotifier(this._ref, this._api, this._conversationId)
      : _useMockFallback = !_hasFlutterBinding(),
        super(const AiChatState()) {
    if (_useMockFallback) {
      _loadMockConversation();
    } else {
      _loadConversation();
    }
  }

  final Ref _ref;
  final AiApiService _api;
  String _conversationId;
  final bool _useMockFallback;
  StreamSubscription<AiChatStreamEvent>? _streamSubscription;
  CancelToken? _streamCancelToken;

  @override
  void dispose() {
    _streamSubscription?.cancel();
    _streamCancelToken?.cancel();
    super.dispose();
  }

  Future<void> _loadConversation() async {
    if (_conversationId.trim().isEmpty) {
      state = const AiChatState();
      return;
    }

    try {
      final messages = await _api.listMessages(_conversationId, limit: 100);
      state = state.copyWith(
        messages: List.of(messages),
        tokensUsed: messages.fold<int>(0, (sum, m) => sum + m.content.length ~/ 4),
      );
    } catch (_) {
      state = const AiChatState();
    }
  }

  void _loadMockConversation() {
    final messages = MockAiData.initialMessages[_conversationId] ?? [];
    state = state.copyWith(
      messages: List.of(messages),
      tokensUsed: messages.fold<int>(0, (sum, m) => sum + m.content.length ~/ 4),
    );
  }

  Future<void> sendMessage(String text, {List<RemoteAttachment> attachments = const []}) async {
    final trimmed = text.trim();
    if ((trimmed.isEmpty && attachments.isEmpty) || state.isStreaming) {
      return;
    }
    final attachmentIds = attachments.map((a) => a.id).toList();

    if (_useMockFallback) {
      final now = DateTime.now();
      final userMessage = AiMessage(
        id: 'user-${now.millisecondsSinceEpoch}',
        role: AiMessageRole.user,
        content: trimmed,
        timestamp: now,
      );
      final assistantMessage = AiMessage(
        id: 'ai-${now.millisecondsSinceEpoch}',
        role: AiMessageRole.assistant,
        content: MockAiData.mockResponseTemplate,
        timestamp: now.add(const Duration(milliseconds: 100)),
      );
      state = state.copyWith(
        messages: [...state.messages, userMessage, assistantMessage],
        isStreaming: false,
        activeTool: null,
      );
      return;
    }

    if (_conversationId.trim().isEmpty) {
      final conversation = await _api.createConversation();
      _conversationId = conversation.id;
      _ref.read(activeConversationIdProvider.notifier).state = conversation.id;
      _ref.read(aiConversationsStoreProvider.notifier).prepend(conversation);
    }

    final now = DateTime.now();
    final userMessage = AiMessage(
      id: 'user-${now.millisecondsSinceEpoch}',
      role: AiMessageRole.user,
      content: trimmed,
      timestamp: now,
      knownAttachments: attachments,
    );
    final assistantId = 'assistant-${now.millisecondsSinceEpoch}';
    final assistantPlaceholder = AiMessage(
      id: assistantId,
      role: AiMessageRole.assistant,
      content: '',
      timestamp: now.add(const Duration(milliseconds: 1)),
      isStreaming: true,
      streamedContent: '',
    );

    state = state.copyWith(
      messages: [...state.messages, userMessage, assistantPlaceholder],
      isStreaming: true,
      activeTool: null,
    );

    _ref.read(analyticsServiceProvider).logEvent('ai_message_sent');

    final buffer = StringBuffer();
    _streamCancelToken = CancelToken();

    _streamSubscription = _api
        .streamMessage(
          _conversationId,
          content: trimmed,
          attachmentIds: attachmentIds,
          cancelToken: _streamCancelToken,
        )
        .listen(
      (event) {
        switch (event) {
          case AiContentDeltaEvent(:final delta):
            buffer.write(delta);
            _updateAssistantMessage(assistantId, streamedContent: buffer.toString());
          case AiToolCallStartEvent(:final toolName):
            state = state.copyWith(
              activeTool: AiToolExecution(
                id: 'tool-${DateTime.now().millisecondsSinceEpoch}',
                toolName: toolName,
                status: AiToolStatus.running,
                output: '',
              ),
            );
          case AiToolCallResultEvent():
            final tool = state.activeTool;
            if (tool != null) {
              state = state.copyWith(activeTool: tool.copyWith(status: AiToolStatus.completed));
            }
          case AiToolCallErrorEvent(:final message):
            final tool = state.activeTool;
            if (tool != null) {
              state = state.copyWith(activeTool: tool.copyWith(status: AiToolStatus.failed, output: message));
            }
          case AiMessageEndEvent():
          case AiStreamUnhandledEvent():
            break;
        }
      },
      onDone: () async {
        _finalizeAssistantMessage(assistantId, buffer.toString());
        state = state.copyWith(isStreaming: false);
        _streamSubscription = null;
        _streamCancelToken = null;
        await _ref.read(aiConversationsStoreProvider.notifier).reload();
      },
      onError: (Object _) {
        _finalizeAssistantMessage(
          assistantId,
          buffer.toString().isEmpty
              ? 'Something went wrong while generating a response. Please try again.'
              : buffer.toString(),
        );
        state = state.copyWith(isStreaming: false, activeTool: null);
        _streamSubscription = null;
        _streamCancelToken = null;
      },
      cancelOnError: true,
    );
  }

  // Called once per streamed token/delta, so this has to stay O(1) rather
  // than scanning the whole conversation — the streaming placeholder is
  // always the last message (appended alongside the user message at the
  // start of the turn, never reordered), so only that slot needs replacing.
  void _updateAssistantMessage(String id, {required String streamedContent}) {
    final messages = state.messages;
    if (messages.isEmpty || messages.last.id != id) {
      return;
    }
    state = state.copyWith(
      messages: [
        ...messages.sublist(0, messages.length - 1),
        messages.last.copyWith(streamedContent: streamedContent),
      ],
    );
  }

  void _finalizeAssistantMessage(String id, String finalContent) {
    state = state.copyWith(
      messages: [
        for (final message in state.messages)
          if (message.id == id)
            message.copyWith(content: finalContent, streamedContent: finalContent, isStreaming: false)
          else
            message,
      ],
    );
  }

  void stopGeneration() {
    if (!state.isStreaming) {
      return;
    }
    _streamCancelToken?.cancel('User stopped generation');
    _streamSubscription?.cancel();
    _streamSubscription = null;
    _streamCancelToken = null;

    final streamingMessage = state.messages.where((m) => m.isStreaming).lastOrNull;
    if (streamingMessage != null) {
      _finalizeAssistantMessage(streamingMessage.id, streamingMessage.streamedContent ?? '');
    }
    state = state.copyWith(
      isStreaming: false,
      clearTool: true,
    );
  }

  void regenerateLastResponse() {
    if (state.isStreaming) {
      return;
    }
    final messages = List<AiMessage>.of(state.messages);
    if (messages.isEmpty || !messages.last.isAssistant) {
      return;
    }
    messages.removeLast();
    state = state.copyWith(messages: messages);

    final lastUser = messages.lastWhere(
      (m) => m.isUser,
      orElse: () => messages.last,
    );
    sendMessage(lastUser.content);
  }

}

final aiChatProvider = StateNotifierProvider.autoDispose
    .family<AiChatNotifier, AiChatState, String>((ref, conversationId) {
  return AiChatNotifier(ref, ref.watch(aiApiServiceProvider), conversationId);
});

// --- Shell layout ---

class AiShellLayoutState {
  const AiShellLayoutState({
    this.showAgentPanel = true,
    this.showContextPanel = true,
    this.showHistoryPanel = true,
  });

  final bool showAgentPanel;
  final bool showContextPanel;
  final bool showHistoryPanel;

  AiShellLayoutState copyWith({
    bool? showAgentPanel,
    bool? showContextPanel,
    bool? showHistoryPanel,
  }) {
    return AiShellLayoutState(
      showAgentPanel: showAgentPanel ?? this.showAgentPanel,
      showContextPanel: showContextPanel ?? this.showContextPanel,
      showHistoryPanel: showHistoryPanel ?? this.showHistoryPanel,
    );
  }
}

final aiShellLayoutProvider =
    StateNotifierProvider<AiShellLayoutNotifier, AiShellLayoutState>(
  (ref) => AiShellLayoutNotifier(),
);

class AiShellLayoutNotifier extends StateNotifier<AiShellLayoutState> {
  AiShellLayoutNotifier() : super(const AiShellLayoutState());

  void toggleAgentPanel() {
    state = state.copyWith(showAgentPanel: !state.showAgentPanel);
  }

  void toggleContextPanel() {
    state = state.copyWith(showContextPanel: !state.showContextPanel);
  }

  void toggleHistoryPanel() {
    state = state.copyWith(showHistoryPanel: !state.showHistoryPanel);
  }
}

final agentsProvider = StateNotifierProvider<AiAgentsNotifier, List<AiAgent>>((ref) {
  return AiAgentsNotifier(ref, ref.watch(aiApiServiceProvider));
});

final knowledgeBasesProvider = StateNotifierProvider<AiKnowledgeBasesNotifier, List<AiKnowledgeBase>>((ref) {
  return AiKnowledgeBasesNotifier(ref, ref.watch(knowledgeRepositoryProvider));
});

final availableToolsProvider = StateNotifierProvider<AiToolsNotifier, List<AiToolDescriptor>>((ref) {
  return AiToolsNotifier(ref.watch(aiApiServiceProvider));
});

final memoriesProvider = StateNotifierProvider<AiMemoriesNotifier, List<AiMemory>>((ref) {
  return AiMemoriesNotifier(ref.watch(aiApiServiceProvider));
});

final memorySnapshotProvider = Provider<AiMemorySnapshot>((ref) {
  return AiMemorySnapshot.fromMemories(ref.watch(memoriesProvider));
});

/// Static quick-start shortcuts — see [AiStaticCatalog] doc comment for
/// why this has no backend endpoint to wire to.
final suggestedPromptsProvider = Provider<List<SuggestedPrompt>>(
  (ref) => AiStaticCatalog.suggestedPrompts,
);

/// Static display-only model catalog — see [AiStaticCatalog] doc comment.
final aiModelsProvider = Provider<List<AiModel>>((ref) => AiStaticCatalog.models);

String _titleCase(String value) {
  final trimmed = value.trim();
  if (trimmed.isEmpty) {
    return 'General';
  }
  return trimmed
      .split(RegExp(r'\s+'))
      .where((part) => part.isNotEmpty)
      .map((part) => part[0].toUpperCase() + part.substring(1).toLowerCase())
      .join(' ');
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

String _memorySnippet(AiMemory memory) {
  final content = memory.content.trim();
  if (content.isEmpty) {
    return 'No content';
  }
  if (content.length <= 92) {
    return content;
  }
  return '${content.substring(0, 89)}...';
}
