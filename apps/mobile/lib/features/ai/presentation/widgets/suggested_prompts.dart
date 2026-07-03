import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';
import '../providers/ai_providers.dart';

/// Suggested prompt chips for quick starts.
class SuggestedPrompts extends ConsumerWidget {
  const SuggestedPrompts({required this.onSelect, super.key});

  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final prompts = ref.watch(suggestedPromptsProvider);
    final scheme = Theme.of(context).colorScheme;

    return Wrap(
      spacing: AppSpacing.sm,
      runSpacing: AppSpacing.sm,
      children: [
        for (final prompt in prompts)
          ActionChip(
            avatar: Icon(aiIcon(prompt.iconName), size: 18, color: scheme.primary),
            label: Text(prompt.label),
            onPressed: () => onSelect(prompt.prompt),
            backgroundColor: scheme.primary.withValues(alpha: 0.06),
            side: BorderSide(color: context.voltxColors.borderSubtle),
          ),
      ],
    );
  }
}
