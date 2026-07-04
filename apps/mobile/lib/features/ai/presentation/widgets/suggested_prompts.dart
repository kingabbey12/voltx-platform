import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../theme/tokens/spacing.dart';
import '../providers/ai_providers.dart';
import 'ai_workspace_components.dart';

/// Suggested prompt chips for quick starts.
class SuggestedPrompts extends ConsumerWidget {
  const SuggestedPrompts({required this.onSelect, super.key});

  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final prompts = ref.watch(suggestedPromptsProvider);

    return LayoutBuilder(
      builder: (context, constraints) {
        final maxWidth = constraints.maxWidth.isFinite ? constraints.maxWidth : 280.0;
        final cardWidth = maxWidth < 620 ? maxWidth : 280.0;

        return Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: [
            for (final prompt in prompts)
              SizedBox(
                width: cardWidth,
                child: AiPromptCard(
                  title: prompt.label,
                  prompt: prompt.prompt,
                  icon: aiIcon(prompt.iconName),
                  onTap: () => onSelect(prompt.prompt),
                ),
              ),
          ],
        );
      },
    );
  }
}
