/// Parsed events from the real-time `/ai/conversations/:id/messages/stream`
/// SSE endpoint (backed by `writeGatewayEventStreamToResponse` on the
/// backend). Only the subset of `AiGatewayStreamEvent` the chat UI acts on
/// is modeled here — `status`/`reasoning`/`plan`/`step_started`/
/// `decision`/`next_step` are intentionally not surfaced as distinct chat
/// UI states yet, only the ones that materially change what a message
/// bubble shows.
sealed class AiChatStreamEvent {
  const AiChatStreamEvent();
}

class AiContentDeltaEvent extends AiChatStreamEvent {
  const AiContentDeltaEvent(this.delta);
  final String delta;
}

class AiMessageEndEvent extends AiChatStreamEvent {
  const AiMessageEndEvent({this.outputText});
  final String? outputText;
}

class AiToolCallStartEvent extends AiChatStreamEvent {
  const AiToolCallStartEvent(this.toolName);
  final String toolName;
}

class AiToolCallResultEvent extends AiChatStreamEvent {
  const AiToolCallResultEvent(this.toolName, this.durationMs);
  final String toolName;
  final int durationMs;
}

class AiToolCallErrorEvent extends AiChatStreamEvent {
  const AiToolCallErrorEvent(this.toolName, this.message);
  final String toolName;
  final String message;
}

class AiStreamUnhandledEvent extends AiChatStreamEvent {
  const AiStreamUnhandledEvent(this.type);
  final String type;
}
