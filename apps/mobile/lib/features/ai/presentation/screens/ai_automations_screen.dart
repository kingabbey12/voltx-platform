import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../theme/tokens/spacing.dart';
import '../providers/ai_providers.dart';
import '../shell/ai_nav_bar.dart';
import '../widgets/ai_workspace_components.dart';

/// Automation workflows screen.
class AiAutomationsScreen extends ConsumerWidget {
  const AiAutomationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final automations = ref.watch(automationsProvider);
    final enabled = automations.where((a) => a.enabled).length;

    return Column(
      children: [
        const AiNavBar(),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(AppSpacing.md),
            children: [
              AiPanel(
                header: Text(
                  'Automation Control',
                  style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
                ),
                child: Wrap(
                  spacing: AppSpacing.sm,
                  runSpacing: AppSpacing.sm,
                  children: [
                    AiSuggestionChip(label: '${automations.length} workflows', icon: Icons.bolt_outlined),
                    AiSuggestionChip(label: '$enabled enabled', icon: Icons.play_circle_outline_rounded),
                    AiSuggestionChip(
                      label: '${automations.length - enabled} paused',
                      icon: Icons.pause_circle_outline_rounded,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              for (final auto in automations)
                Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                  child: AiPanel(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Expanded(
                              child: Text(
                                auto.name,
                                style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                              ),
                            ),
                            Switch(
                              value: auto.enabled,
                              onChanged: (_) {},
                            ),
                          ],
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        Text(auto.description),
                        const SizedBox(height: AppSpacing.xs),
                        AiSuggestionChip(
                          label: auto.trigger,
                          icon: Icons.schedule_rounded,
                          color: auto.enabled ? null : Colors.grey,
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        Row(
                          children: [
                            FilledButton.tonalIcon(
                              onPressed: () {},
                              icon: const Icon(Icons.play_arrow_rounded),
                              label: const Text('Run now'),
                            ),
                            const SizedBox(width: AppSpacing.xs),
                            OutlinedButton.icon(
                              onPressed: () {},
                              icon: const Icon(Icons.edit_outlined),
                              label: const Text('Edit'),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
      ],
    );
  }
}
