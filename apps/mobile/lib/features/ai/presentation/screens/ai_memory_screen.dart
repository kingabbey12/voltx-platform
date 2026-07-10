import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../theme/tokens/spacing.dart';
import '../providers/ai_providers.dart';
import '../shell/ai_nav_bar.dart';
import '../widgets/ai_workspace_components.dart';

/// Long-term AI memory browser — real data from `/ai/memories`, grouped by
/// category via the existing `memorySnapshotProvider`.
class AiMemoryScreen extends ConsumerWidget {
  const AiMemoryScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final memories = ref.watch(memoriesProvider);
    final snapshot = ref.watch(memorySnapshotProvider);

    return Column(
      children: [
        const AiNavBar(),
        Expanded(
          child: memories.isEmpty
              ? const Padding(
                  padding: EdgeInsets.all(AppSpacing.md),
                  child: AiEmptyState(
                    title: 'No memories yet',
                    subtitle: 'Preferences, recurring tasks, and context the AI has learned will appear here.',
                    icon: Icons.psychology_outlined,
                  ),
                )
              : ListView(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  children: [
                    AiPanel(
                      header: Text(
                        'Memory overview',
                        style:
                            Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
                      ),
                      child: Wrap(
                        spacing: AppSpacing.xs,
                        runSpacing: AppSpacing.xs,
                        children: [
                          AiSuggestionChip(label: snapshot.statusLabel, icon: Icons.memory_rounded),
                          AiSuggestionChip(label: 'Updated ${snapshot.freshnessLabel}', icon: Icons.update_rounded),
                        ],
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    for (final entry in snapshot.categoryCounts.entries)
                      Padding(
                        padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                        child: AiMemoryCard(
                          title: _titleCase(entry.key),
                          summary: '${entry.value} ${entry.value == 1 ? 'memory' : 'memories'}',
                          items: memories
                              .where((memory) =>
                                  (memory.category.trim().isEmpty ? 'general' : memory.category.trim().toLowerCase()) ==
                                  entry.key)
                              .take(5)
                              .map((memory) => memory.content)
                              .toList(),
                        ),
                      ),
                  ],
                ),
        ),
      ],
    );
  }
}

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
