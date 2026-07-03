import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';
import '../providers/ai_providers.dart';
import '../widgets/ai_selectors.dart';
import '../widgets/typing_indicator.dart';

/// Slide-up context sheet for mobile (agent, model, knowledge).
void showAiContextSheet(BuildContext context) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (context) => const AiContextSheet(),
  );
}

class AiContextSheet extends ConsumerWidget {
  const AiContextSheet({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.voltxColors;
    final model = ref.watch(selectedModelProvider);
    final conversationId = ref.watch(activeConversationIdProvider);
    final chatState = ref.watch(aiChatProvider(conversationId));

    return DraggableScrollableSheet(
      initialChildSize: 0.55,
      minChildSize: 0.35,
      maxChildSize: 0.85,
      builder: (context, scrollController) {
        return Container(
          decoration: BoxDecoration(
            color: colors.surfaceElevated,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: ListView(
            controller: scrollController,
            padding: const EdgeInsets.all(AppSpacing.md),
            children: [
              Center(
                child: Container(
                  width: 36,
                  height: 4,
                  decoration: BoxDecoration(
                    color: colors.borderSubtle,
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              Text('Context', style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: AppSpacing.sm),
              Row(
                children: [
                  Text('Model', style: Theme.of(context).textTheme.labelMedium),
                  const Spacer(),
                  const ModelSelector(),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              Text('Agent', style: Theme.of(context).textTheme.labelMedium),
              const SizedBox(height: AppSpacing.sm),
              const AgentSelector(),
              const SizedBox(height: AppSpacing.md),
              Text('Knowledge', style: Theme.of(context).textTheme.labelMedium),
              const SizedBox(height: AppSpacing.sm),
              const KnowledgeSelector(),
              const SizedBox(height: AppSpacing.lg),
              TokenUsageIndicator(
                tokensUsed: chatState.tokensUsed,
                contextWindow: model.contextWindow,
              ),
            ],
          ),
        );
      },
    );
  }
}
