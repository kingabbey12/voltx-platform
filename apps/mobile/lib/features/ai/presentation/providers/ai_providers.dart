import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/mock/mock_ai_data.dart';
import '../../data/models/ai_models.dart';

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

// --- Selection providers ---

final selectedModelProvider = StateProvider<AiModel>(
  (ref) => MockAiData.models.first,
);

final selectedAgentProvider = StateProvider<AiAgent>(
  (ref) => MockAiData.agents.first,
);

final selectedKnowledgeProvider = StateProvider<AiKnowledgeBase>(
  (ref) => MockAiData.knowledgeBases.first,
);

final activeConversationIdProvider = StateProvider<String>(
  (ref) => MockAiData.conversations.first.id,
);

// --- Conversation list ---

final conversationSearchProvider = StateProvider<String>((ref) => '');

final conversationsProvider = Provider<List<AiConversation>>((ref) {
  final query = ref.watch(conversationSearchProvider).trim().toLowerCase();
  var list = List<AiConversation>.from(MockAiData.conversations);
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
    this.pendingAttachments = const [],
  });

  final List<AiMessage> messages;
  final bool isStreaming;
  final int tokensUsed;
  final AiToolExecution? activeTool;
  final List<AiAttachment> pendingAttachments;

  AiChatState copyWith({
    List<AiMessage>? messages,
    bool? isStreaming,
    int? tokensUsed,
    AiToolExecution? activeTool,
    bool clearTool = false,
    List<AiAttachment>? pendingAttachments,
  }) {
    return AiChatState(
      messages: messages ?? this.messages,
      isStreaming: isStreaming ?? this.isStreaming,
      tokensUsed: tokensUsed ?? this.tokensUsed,
      activeTool: clearTool ? null : (activeTool ?? this.activeTool),
      pendingAttachments: pendingAttachments ?? this.pendingAttachments,
    );
  }
}

class AiChatNotifier extends StateNotifier<AiChatState> {
  AiChatNotifier(this._conversationId) : super(const AiChatState()) {
    _loadConversation();
  }

  final String _conversationId;
  Timer? _streamTimer;
  String? _streamingMessageId;

  void _loadConversation() {
    final messages = MockAiData.initialMessages[_conversationId] ?? [];
    state = state.copyWith(
      messages: List.of(messages),
      tokensUsed: messages.fold<int>(0, (sum, m) => sum + m.content.length ~/ 4),
    );
  }

  void addPendingAttachment(AiAttachment attachment) {
    state = state.copyWith(
      pendingAttachments: [...state.pendingAttachments, attachment],
    );
  }

  void removePendingAttachment(String id) {
    state = state.copyWith(
      pendingAttachments: [
        for (final a in state.pendingAttachments)
          if (a.id != id) a,
      ],
    );
  }

  Future<void> sendMessage(String text) async {
    final trimmed = text.trim();
    if (trimmed.isEmpty || state.isStreaming) {
      return;
    }

    final now = DateTime.now();
    final userMessage = AiMessage(
      id: 'user-${now.millisecondsSinceEpoch}',
      role: AiMessageRole.user,
      content: trimmed,
      timestamp: now,
      attachments: List.of(state.pendingAttachments),
    );

    final assistantId = 'ai-${now.millisecondsSinceEpoch}';
    final assistantMessage = AiMessage(
      id: assistantId,
      role: AiMessageRole.assistant,
      content: MockAiData.mockResponseTemplate,
      timestamp: now.add(const Duration(milliseconds: 100)),
      isStreaming: true,
      streamedContent: '',
    );

    state = state.copyWith(
      messages: [...state.messages, userMessage, assistantMessage],
      isStreaming: true,
      pendingAttachments: [],
      activeTool: const AiToolExecution(
        id: 'tool-1',
        toolName: 'query_grid_data',
        status: AiToolStatus.running,
        output: 'Fetching North Region metrics…',
      ),
    );

    _streamingMessageId = assistantId;
    await _simulateToolExecution();
    await _streamResponse(assistantId, MockAiData.mockResponseTemplate);
  }

  Future<void> _simulateToolExecution() async {
    await Future<void>.delayed(const Duration(milliseconds: 600));
    if (!mounted) {
      return;
    }
    state = state.copyWith(
      activeTool: state.activeTool?.copyWith(
        status: AiToolStatus.completed,
        output: 'Retrieved 3 data sources · 1.2s',
      ),
    );
    await Future<void>.delayed(const Duration(milliseconds: 300));
    if (!mounted) {
      return;
    }
    state = state.copyWith(clearTool: true);
  }

  Future<void> _streamResponse(String messageId, String fullText) async {
    final completer = Completer<void>();
    var index = 0;
    const chunkSize = 3;

    _streamTimer = Timer.periodic(const Duration(milliseconds: 18), (timer) {
      if (!mounted) {
        timer.cancel();
        completer.complete();
        return;
      }

      index = (index + chunkSize).clamp(0, fullText.length);
      final streamed = fullText.substring(0, index);

      state = state.copyWith(
        messages: [
          for (final m in state.messages)
            if (m.id == messageId)
              m.copyWith(streamedContent: streamed, isStreaming: index < fullText.length)
            else
              m,
        ],
        tokensUsed: state.tokensUsed + chunkSize ~/ 4,
      );

      if (index >= fullText.length) {
        timer.cancel();
        state = state.copyWith(
          isStreaming: false,
          messages: [
            for (final m in state.messages)
              if (m.id == messageId)
                m.copyWith(
                  content: fullText,
                  isStreaming: false,
                  streamedContent: fullText,
                )
              else
                m,
          ],
        );
        _streamingMessageId = null;
        completer.complete();
      }
    });

    return completer.future;
  }

  void stopGeneration() {
    _streamTimer?.cancel();
    if (_streamingMessageId == null) {
      return;
    }
    final id = _streamingMessageId!;
    state = state.copyWith(
      isStreaming: false,
      messages: [
        for (final m in state.messages)
          if (m.id == id)
            m.copyWith(
              isStreaming: false,
              content: '${m.displayContent}\n\n*[Generation stopped]*',
              streamedContent: m.displayContent,
            )
          else
            m,
      ],
      clearTool: true,
    );
    _streamingMessageId = null;
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

  @override
  void dispose() {
    _streamTimer?.cancel();
    super.dispose();
  }
}

final aiChatProvider = StateNotifierProvider.autoDispose
    .family<AiChatNotifier, AiChatState, String>((ref, conversationId) {
  return AiChatNotifier(conversationId);
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

final automationsProvider = Provider<List<AiAutomation>>(
  (ref) => MockAiData.automations,
);

final agentsProvider = Provider<List<AiAgent>>((ref) => MockAiData.agents);

final knowledgeBasesProvider = Provider<List<AiKnowledgeBase>>(
  (ref) => MockAiData.knowledgeBases,
);

final suggestedPromptsProvider = Provider<List<SuggestedPrompt>>(
  (ref) => MockAiData.suggestedPrompts,
);

final aiModelsProvider = Provider<List<AiModel>>((ref) => MockAiData.models);
