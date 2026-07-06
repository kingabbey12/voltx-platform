import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltx_mobile/features/ai/data/catalog/ai_static_catalog.dart';
import 'package:voltx_mobile/features/ai/data/mock/mock_ai_data.dart';
import 'package:voltx_mobile/features/ai/presentation/providers/ai_providers.dart';

void main() {
  group('AI static catalog', () {
    test('has models and suggested prompts', () {
      expect(AiStaticCatalog.models.length, greaterThanOrEqualTo(2));
      expect(AiStaticCatalog.suggestedPrompts.length, 4);
    });
  });

  group('AI mock data', () {
    test('has agents and conversations for the no-binding fallback path', () {
      expect(MockAiData.agents.length, greaterThanOrEqualTo(2));
      expect(MockAiData.conversations.length, greaterThanOrEqualTo(3));
    });
  });

  group('AI providers', () {
    test('conversation search filters results', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      container.read(conversationSearchProvider.notifier).state = 'North';
      final results = container.read(conversationsProvider);
      expect(results.any((c) => c.title.contains('North')), isTrue);
    });

    test('sendMessage streams assistant response', () async {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      final convId = MockAiData.conversations.first.id;
      final notifier = container.read(aiChatProvider(convId).notifier);
      await notifier.sendMessage('Test question');

      final state = container.read(aiChatProvider(convId));
      expect(state.messages.length, greaterThanOrEqualTo(3));
      expect(state.messages.last.isAssistant, isTrue);
      expect(state.messages.last.displayContent, isNotEmpty);
    });

    test('stopGeneration halts streaming', () async {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      final convId = MockAiData.conversations.first.id;
      container.listen(aiChatProvider(convId), (_, _) {});
      final notifier = container.read(aiChatProvider(convId).notifier);
      final future = notifier.sendMessage('Another test');
      await Future<void>.delayed(const Duration(milliseconds: 80));
      notifier.stopGeneration();
      await future;

      final state = container.read(aiChatProvider(convId));
      expect(state.isStreaming, isFalse);
    });

    test('model and agent selection updates', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      final model = AiStaticCatalog.models[1];
      container.read(selectedModelProvider.notifier).state = model;
      expect(container.read(selectedModelProvider).id, model.id);

      final agent = MockAiData.agents[1];
      container.read(selectedAgentProvider.notifier).state = agent;
      expect(container.read(selectedAgentProvider).id, agent.id);
    });
  });
}
