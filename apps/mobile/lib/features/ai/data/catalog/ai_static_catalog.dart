import '../models/ai_models.dart';

/// Static, client-side-only reference data — NOT a stand-in for a backend
/// response. The backend has no `/ai/models` listing endpoint (model/
/// provider selection happens server-side, defaulted from
/// `ai.defaultProvider`/`ai.defaultModel` config — see
/// `ModelRegistryService`), and "suggested prompts" has no backend
/// concept at all. Both are legitimately static: the model catalog is
/// display-only labeling for the (decorative) model picker, and the
/// prompt list is a fixed set of quick-start shortcuts. Neither
/// represents live/dynamic backend state, so neither belongs behind a
/// network call.
abstract final class AiStaticCatalog {
  static const models = [
    AiModel(
      id: 'voltx-pro',
      name: 'Voltx Pro',
      description: 'Best for complex operations analysis',
      contextWindow: 128000,
      costPer1kTokens: 0.012,
    ),
    AiModel(
      id: 'voltx-fast',
      name: 'Voltx Fast',
      description: 'Quick responses for everyday tasks',
      contextWindow: 32000,
      costPer1kTokens: 0.004,
    ),
    AiModel(
      id: 'voltx-code',
      name: 'Voltx Code',
      description: 'Optimized for technical workflows',
      contextWindow: 64000,
      costPer1kTokens: 0.008,
    ),
  ];

  static const suggestedPrompts = [
    SuggestedPrompt(
      id: 'sp-1',
      label: "Summarize today's alerts",
      prompt: 'Summarize all grid alerts from the last 24 hours and highlight any that need executive attention.',
      iconName: 'alert',
    ),
    SuggestedPrompt(
      id: 'sp-2',
      label: 'Draft ops briefing',
      prompt: 'Draft a morning operations briefing covering KPIs, incidents, and recommended actions.',
      iconName: 'doc',
    ),
    SuggestedPrompt(
      id: 'sp-3',
      label: 'Analyze peak demand',
      prompt: 'What caused the peak demand alert in North Region and what preventive measures do you recommend?',
      iconName: 'chart',
    ),
    SuggestedPrompt(
      id: 'sp-4',
      label: 'Review maintenance schedule',
      prompt: 'Review upcoming maintenance windows and flag any conflicts with projected peak demand.',
      iconName: 'build',
    ),
  ];
}
