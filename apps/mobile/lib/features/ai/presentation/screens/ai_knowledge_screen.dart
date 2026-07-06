import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../shared/widgets/async_value_view.dart';
import '../../../../shared/widgets/pull_to_refresh.dart';
import '../../../../theme/components/voltx_text_field.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../knowledge/data/models/knowledge_models.dart';
import '../../../knowledge/presentation/providers/knowledge_providers.dart';
import '../providers/ai_providers.dart';
import '../shell/ai_nav_bar.dart';
import '../widgets/ai_workspace_components.dart';

/// Knowledge Graph workspace — real sources, documents, and semantic
/// search against the backend's Enterprise Knowledge Graph (VT-023),
/// plus the AI memory panel (already real via `/ai/memories`).
class AiKnowledgeScreen extends ConsumerWidget {
  const AiKnowledgeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectedSourceId = ref.watch(_selectedSourceIdProvider);
    final sources = ref.watch(knowledgeSourcesProvider(const KnowledgePageQuery(limit: 50)));
    final memorySnapshot = ref.watch(memorySnapshotProvider);
    final isDesktop = MediaQuery.sizeOf(context).width >= 1100;
    final isTablet = MediaQuery.sizeOf(context).width >= 780;

    Future<void> refresh() async {
      ref.invalidate(knowledgeSourcesProvider);
      ref.invalidate(knowledgeStatsProvider);
      ref.invalidate(knowledgeHealthProvider);
      if (selectedSourceId != null) {
        ref.invalidate(knowledgeSourceDocumentsProvider(selectedSourceId));
      }
    }

    final leftNav = _KnowledgeLeftNav(
      sources: sources,
      selectedId: selectedSourceId,
      onSelect: (id) => ref.read(_selectedSourceIdProvider.notifier).state = id,
      onRetry: () => ref.invalidate(knowledgeSourcesProvider),
    );

    final mainWorkspace = _KnowledgeMainWorkspace(selectedSourceId: selectedSourceId);

    final rightPanel = _KnowledgeRightPanel(memorySnapshot: memorySnapshot);

    return Column(
      children: [
        const AiNavBar(),
        Expanded(
          child: PullToRefresh(
            onRefresh: refresh,
            child: Container(
              margin: const EdgeInsets.all(AppSpacing.md),
              child: isDesktop
                  ? SingleChildScrollView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      child: IntrinsicHeight(
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(flex: 3, child: leftNav),
                            const SizedBox(width: AppSpacing.md),
                            Expanded(flex: 7, child: mainWorkspace),
                            const SizedBox(width: AppSpacing.md),
                            Expanded(flex: 4, child: rightPanel),
                          ],
                        ),
                      ),
                    )
                  : ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      children: [
                        mainWorkspace,
                        const SizedBox(height: AppSpacing.md),
                        rightPanel,
                        if (isTablet) ...[
                          const SizedBox(height: AppSpacing.md),
                          leftNav,
                        ],
                      ],
                    ),
            ),
          ),
        ),
      ],
    );
  }
}

final _selectedSourceIdProvider = StateProvider<String?>((ref) => null);

class _KnowledgeLeftNav extends StatelessWidget {
  const _KnowledgeLeftNav({
    required this.sources,
    required this.selectedId,
    required this.onSelect,
    required this.onRetry,
  });

  final AsyncValue<PaginatedKnowledgeResult<KnowledgeSource>> sources;
  final String? selectedId;
  final ValueChanged<String?> onSelect;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return AiPanel(
      highlighted: true,
      header: Row(
        children: [
          Text(
            'Knowledge Sources',
            style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
          ),
          const Spacer(),
          const AiSuggestionChip(label: 'Live', icon: Icons.cloud_done_outlined),
        ],
      ),
      child: AsyncValueView<PaginatedKnowledgeResult<KnowledgeSource>>(
        value: sources,
        onRetry: onRetry,
        isEmpty: (result) => result.items.isEmpty,
        empty: (context) => const AiEmptyState(
          title: 'No knowledge sources yet',
          subtitle: 'Connect a CRM stream, upload documents, or sync an integration to populate the graph.',
          icon: Icons.menu_book_outlined,
        ),
        data: (context, result) => Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.xs),
              child: AiKnowledgeCard(
                title: 'All Sources',
                description: 'View documents across every connected source',
                documents: result.items.length,
                category: selectedId == null ? 'Active' : 'All',
                lastSynced: 'now',
                selected: selectedId == null,
                onTap: () => onSelect(null),
              ),
            ),
            for (final source in result.items)
              Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.xs),
                child: AiKnowledgeCard(
                  title: source.name,
                  description: source.description ?? source.type,
                  documents: 0,
                  category: source.status,
                  lastSynced: source.lastIndexedAt == null ? 'never' : _relative(source.lastIndexedAt!),
                  selected: source.id == selectedId,
                  onTap: () => onSelect(source.id),
                ),
              ),
          ],
        ),
      ),
    );
  }

  String _relative(String iso) {
    final dt = DateTime.tryParse(iso);
    if (dt == null) {
      return iso;
    }
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 60) {
      return '${diff.inMinutes}m ago';
    }
    if (diff.inHours < 24) {
      return '${diff.inHours}h ago';
    }
    return '${diff.inDays}d ago';
  }
}

class _KnowledgeMainWorkspace extends ConsumerWidget {
  const _KnowledgeMainWorkspace({required this.selectedSourceId});

  final String? selectedSourceId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final searchState = ref.watch(knowledgeSearchControllerProvider);
    final searchQuery = ref.watch(knowledgeSearchQueryProvider);

    return ListView(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      children: [
        AiPanel(
          highlighted: true,
          header: Text(
            'Semantic Search',
            style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              VoltxTextField(
                hint: 'Ask the knowledge graph anything...',
                prefixIcon: Icons.search_rounded,
                onChanged: (value) {
                  ref.read(knowledgeSearchQueryProvider.notifier).state = value;
                },
                onSubmitted: (value) {
                  ref.read(knowledgeSearchControllerProvider.notifier).search(value);
                },
              ),
              const SizedBox(height: AppSpacing.sm),
              Wrap(
                spacing: AppSpacing.xs,
                children: [
                  FilledButton.tonalIcon(
                    onPressed: searchState.isLoading
                        ? null
                        : () => ref.read(knowledgeSearchControllerProvider.notifier).search(searchQuery),
                    icon: const Icon(Icons.auto_awesome_rounded, size: 18),
                    label: const Text('Search'),
                  ),
                  if (searchState.hasSearched)
                    OutlinedButton(
                      onPressed: () {
                        ref.read(knowledgeSearchControllerProvider.notifier).clear();
                        ref.read(knowledgeSearchQueryProvider.notifier).state = '';
                      },
                      child: const Text('Clear'),
                    ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        if (searchState.hasSearched)
          _SearchResultsSection(state: searchState)
        else
          _SourceDocumentsSection(sourceId: selectedSourceId),
      ],
    );
  }
}

class _SearchResultsSection extends StatelessWidget {
  const _SearchResultsSection({required this.state});

  final KnowledgeSearchState state;

  @override
  Widget build(BuildContext context) {
    return AiPanel(
      header: Text(
        'Search Results',
        style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
      ),
      child: state.isLoading
          ? const AiLoadingState(lines: 3)
          : state.errorMessage != null
              ? InlineErrorCard(message: state.errorMessage!)
              : state.results.isEmpty
                  ? const AiEmptyState(
                      title: 'No matches found',
                      subtitle: 'Try a different phrasing or broaden your query.',
                      icon: Icons.search_off_rounded,
                    )
                  : Column(
                      children: [
                        for (final result in state.results)
                          Padding(
                            padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                            child: _SearchResultCard(result: result),
                          ),
                      ],
                    ),
    );
  }
}

class _SearchResultCard extends StatelessWidget {
  const _SearchResultCard({required this.result});

  final KnowledgeSearchResult result;

  @override
  Widget build(BuildContext context) {
    return AiPanel(
      highlighted: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  result.citation.documentTitle,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                ),
              ),
              AiSuggestionChip(
                label: '${(result.confidence * 100).round()}% confidence',
                icon: Icons.verified_rounded,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(result.content, style: Theme.of(context).textTheme.bodySmall),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              Expanded(
                child: AiContextCard(label: 'Source', value: result.citation.sourceName),
              ),
              const SizedBox(width: AppSpacing.xs),
              Expanded(
                child: AiContextCard(label: 'Type', value: result.citation.sourceType),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SourceDocumentsSection extends ConsumerWidget {
  const _SourceDocumentsSection({required this.sourceId});

  final String? sourceId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (sourceId == null) {
      return const AiPanel(
        child: AiEmptyState(
          title: 'Select a source',
          subtitle: 'Choose a knowledge source from the left to view its indexed documents.',
          icon: Icons.folder_open_outlined,
        ),
      );
    }

    final documents = ref.watch(knowledgeSourceDocumentsProvider(sourceId!));

    return AiPanel(
      header: Text(
        'Indexed Documents',
        style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
      ),
      child: AsyncValueView<PaginatedKnowledgeResult<KnowledgeDocument>>(
        value: documents,
        onRetry: () => ref.invalidate(knowledgeSourceDocumentsProvider(sourceId!)),
        isEmpty: (result) => result.items.isEmpty,
        empty: (context) => const AiEmptyState(
          title: 'No documents indexed yet',
          subtitle: 'Documents will appear here once this source finishes indexing.',
          icon: Icons.description_outlined,
        ),
        data: (context, result) => Column(
          children: [
            for (final document in result.items)
              Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                child: AiPanel(
                  highlighted: true,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Expanded(
                            child: Text(
                              document.title,
                              style: Theme.of(context)
                                  .textTheme
                                  .titleSmall
                                  ?.copyWith(fontWeight: FontWeight.w700),
                            ),
                          ),
                          AiSuggestionChip(label: document.status, icon: Icons.description_outlined),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        document.contentType,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                      if (document.error != null) ...[
                        const SizedBox(height: AppSpacing.xs),
                        Text(
                          document.error!,
                          style: Theme.of(context)
                              .textTheme
                              .bodySmall
                              ?.copyWith(color: Theme.of(context).colorScheme.error),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _KnowledgeRightPanel extends ConsumerWidget {
  const _KnowledgeRightPanel({required this.memorySnapshot});

  final dynamic memorySnapshot;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final stats = ref.watch(knowledgeStatsProvider);
    final health = ref.watch(knowledgeHealthProvider);

    return ListView(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      children: [
        AiPanel(
          header: Text(
            'Knowledge Graph Health',
            style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
          ),
          child: AsyncValueView(
            value: health,
            onRetry: () => ref.invalidate(knowledgeHealthProvider),
            data: (context, result) => Column(
              children: [
                AiContextCard(
                  label: 'Status',
                  value: result.healthy ? 'Healthy' : 'Needs attention',
                ),
                for (final reason in result.reasons) ...[
                  const SizedBox(height: AppSpacing.xs),
                  AiContextCard(label: 'Reason', value: reason),
                ],
              ],
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        AiPanel(
          header: Text(
            'Index Statistics',
            style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
          ),
          child: AsyncValueView(
            value: stats,
            onRetry: () => ref.invalidate(knowledgeStatsProvider),
            data: (context, result) => Column(
              children: [
                AiContextCard(label: 'Sources', value: '${result.indexSize.sourceCount}'),
                const SizedBox(height: AppSpacing.xs),
                AiContextCard(label: 'Documents', value: '${result.indexSize.documentCount}'),
                const SizedBox(height: AppSpacing.xs),
                AiContextCard(label: 'Chunks', value: '${result.indexSize.chunkCount}'),
                const SizedBox(height: AppSpacing.xs),
                AiContextCard(label: 'Entities', value: '${result.indexSize.entityCount}'),
                const SizedBox(height: AppSpacing.xs),
                AiContextCard(
                  label: 'Avg. search latency',
                  value: '${result.retrieval.averageLatencyMs.round()}ms',
                ),
                const SizedBox(height: AppSpacing.xs),
                AiContextCard(
                  label: 'Cache hit rate',
                  value: '${(result.retrieval.cacheHitRate * 100).round()}%',
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        if ((memorySnapshot.recentHighlights as List).isNotEmpty)
          AiMemoryCard(
            title: 'Executive Memory Indicators',
            summary: memorySnapshot.statusLabel as String,
            items: (memorySnapshot.recentHighlights as List).cast<String>(),
          ),
      ],
    );
  }
}
