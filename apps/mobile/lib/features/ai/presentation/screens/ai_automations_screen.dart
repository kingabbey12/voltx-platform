import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../theme/components/voltx_card.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';
import '../providers/ai_providers.dart';
import '../shell/ai_nav_bar.dart';

/// Automation workflows screen.
class AiAutomationsScreen extends ConsumerWidget {
  const AiAutomationsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final automations = ref.watch(automationsProvider);
    final colors = context.voltxColors;

    return Column(
      children: [
        const AiNavBar(),
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.all(AppSpacing.md),
            itemCount: automations.length,
            itemBuilder: (context, index) {
              final auto = automations[index];
              return Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                child: VoltxCard(
                  child: Row(
                    children: [
                      Switch(
                        value: auto.enabled,
                        onChanged: (_) {},
                      ),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(auto.name, style: Theme.of(context).textTheme.titleSmall),
                            Text(
                              auto.description,
                              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: colors.textSecondary,
                                  ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              auto.trigger,
                              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                                    color: colors.textTertiary,
                                  ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}
