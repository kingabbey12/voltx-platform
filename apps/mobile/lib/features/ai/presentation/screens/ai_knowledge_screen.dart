import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../theme/components/voltx_text_field.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../data/models/ai_models.dart';
import '../providers/ai_providers.dart';
import '../shell/ai_nav_bar.dart';
import '../widgets/ai_workspace_components.dart';
import '../widgets/typing_indicator.dart';

/// Knowledge and memory workspace screen.
class AiKnowledgeScreen extends ConsumerWidget {
  const AiKnowledgeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bases = ref.watch(knowledgeBasesProvider);
    final selected = ref.watch(selectedKnowledgeProvider);
    final model = ref.watch(selectedModelProvider);
    final isDesktop = MediaQuery.sizeOf(context).width >= 1100;
    final isTablet = MediaQuery.sizeOf(context).width >= 780;

    final docs = _buildDocuments(bases);
    final frequent = docs.take(3).toList();
    final recent = docs.take(4).toList();

    return Column(
      children: [
        const AiNavBar(),
        Expanded(
          child: Container(
            margin: const EdgeInsets.all(AppSpacing.md),
            child: isDesktop
                ? Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        flex: 3,
                        child: _KnowledgeLeftNav(
                          bases: bases,
                          selected: selected,
                          onSelect: (kb) => ref.read(selectedKnowledgeProvider.notifier).state = kb,
                        ),
                      ),
                      const SizedBox(width: AppSpacing.md),
                      Expanded(
                        flex: 7,
                        child: _KnowledgeMainWorkspace(
                          selected: selected,
                          recent: recent,
                          frequent: frequent,
                          related: docs.skip(1).take(3).toList(),
                        ),
                      ),
                      const SizedBox(width: AppSpacing.md),
                      Expanded(
                        flex: 4,
                        child: _KnowledgeRightPanel(
                          selected: selected,
                          model: model,
                          docCount: docs.length,
                          sourceCount: bases.length,
                        ),
                      ),
                    ],
                  )
                : ListView(
                    children: [
                      _KnowledgeMainWorkspace(
                        selected: selected,
                        recent: recent,
                        frequent: frequent,
                        related: docs.skip(1).take(3).toList(),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      _KnowledgeRightPanel(
                        selected: selected,
                        model: model,
                        docCount: docs.length,
                        sourceCount: bases.length,
                      ),
                      if (isTablet) ...[
                        const SizedBox(height: AppSpacing.md),
                        _KnowledgeLeftNav(
                          bases: bases,
                          selected: selected,
                          onSelect: (kb) => ref.read(selectedKnowledgeProvider.notifier).state = kb,
                        ),
                      ],
                    ],
                  ),
          ),
        ),
      ],
    );
  }

  List<_KnowledgeDocument> _buildDocuments(List<AiKnowledgeBase> bases) {
    if (bases.isEmpty) {
      return const [];
    }

    final primary = bases.first;
    final docs = <_KnowledgeDocument>[];
    for (var i = 0; i < bases.length; i++) {
      final kb = bases[i];
      docs.add(
        _KnowledgeDocument(
          title: '${kb.name} Governance Playbook',
          tags: [
            _category(kb),
            i.isEven ? 'Executive' : 'Operations',
            'Memory',
          ],
          aiSummary:
              'AI summary: ${kb.description}. This collection contains high-value knowledge used for executive response generation.',
          lastUpdated: _relative(kb.lastSynced),
          confidence: 88 + (i % 10),
          source: kb.name,
        ),
      );
    }

    docs.add(
      _KnowledgeDocument(
        title: 'Company Strategy Memory Index',
        tags: const ['Company Documents', 'Priority', 'Shared'],
        aiSummary:
            'AI summary: Strategic initiatives, quarterly goals, and board-level directives mapped into retrieval memory.',
        lastUpdated: _relative(primary.lastSynced.subtract(const Duration(hours: 4))),
        confidence: 93,
        source: 'Executive Repository',
      ),
    );

    docs.add(
      _KnowledgeDocument(
        title: 'Personal Decision Notes',
        tags: const ['Personal Memory', 'Private', 'Recent'],
        aiSummary:
            'AI summary: Individual guidance preferences and decision heuristics for concise action-first responses.',
        lastUpdated: _relative(primary.lastSynced.subtract(const Duration(hours: 2))),
        confidence: 90,
        source: 'User Memory Scope',
      ),
    );

    return docs;
  }

  String _relative(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 60) {
      return '${diff.inMinutes}m ago';
    }
    if (diff.inHours < 24) {
      return '${diff.inHours}h ago';
    }
    return '${diff.inDays}d ago';
  }

  String _category(AiKnowledgeBase kb) {
    final lower = kb.name.toLowerCase();
    if (lower.contains('operations')) {
      return 'Knowledge Bases';
    }
    if (lower.contains('grid')) {
      return 'Company Documents';
    }
    return 'Shared Memory';
  }
}

class _KnowledgeLeftNav extends StatelessWidget {
  const _KnowledgeLeftNav({
    required this.bases,
    required this.selected,
    required this.onSelect,
  });

  final List<AiKnowledgeBase> bases;
  final AiKnowledgeBase selected;
  final ValueChanged<AiKnowledgeBase> onSelect;

  @override
  Widget build(BuildContext context) {
    final sections = <(String, IconData, int)>[
      ('Knowledge Bases', Icons.menu_book_outlined, bases.length),
      ('Uploaded Files', Icons.upload_file_rounded, 18),
      ('Company Documents', Icons.domain_verification_outlined, 42),
      ('Personal Memory', Icons.person_outline_rounded, 12),
      ('Shared Memory', Icons.people_outline_rounded, 27),
    ];

    return AiPanel(
      highlighted: true,
      header: Row(
        children: [
          Text(
            'Knowledge Navigation',
            style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
          ),
          const Spacer(),
          const AiSuggestionChip(label: 'Memory', icon: Icons.memory_rounded),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var i = 0; i < sections.length; i++)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.xs),
              child: _NavTile(
                label: sections[i].$1,
                icon: sections[i].$2,
                count: sections[i].$3,
                selected: i == 0,
              ),
            ),
          const SizedBox(height: AppSpacing.sm),
          const Divider(height: 1),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Knowledge Bases',
            style: Theme.of(context).textTheme.labelLarge?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: AppSpacing.xs),
          for (final kb in bases)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.xs),
              child: AiKnowledgeCard(
                title: kb.name,
                description: kb.description,
                documents: kb.documentCount,
                category: kb.id == selected.id ? 'Active' : 'Linked',
                lastSynced: _relative(kb.lastSynced),
                selected: kb.id == selected.id,
                onTap: () => onSelect(kb),
              ),
            ),
          if (bases.isEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            const AiLoadingState(lines: 2),
          ],
        ],
      ),
    );
  }

  String _relative(DateTime dt) {
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

class _KnowledgeMainWorkspace extends StatelessWidget {
  const _KnowledgeMainWorkspace({
    required this.selected,
    required this.recent,
    required this.frequent,
    required this.related,
  });

  final AiKnowledgeBase selected;
  final List<_KnowledgeDocument> recent;
  final List<_KnowledgeDocument> frequent;
  final List<_KnowledgeDocument> related;

  @override
  Widget build(BuildContext context) {
    return ListView(
      children: [
        AiPanel(
          highlighted: true,
          header: Row(
            children: [
              Text(
                'Executive AI Memory Workspace',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
              ),
              const Spacer(),
              AiSuggestionChip(
                label: selected.name,
                icon: Icons.menu_book_outlined,
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const VoltxTextField(
                hint: 'Search memory, documents, and semantic knowledge...',
                prefixIcon: Icons.search_rounded,
              ),
              const SizedBox(height: AppSpacing.sm),
              AiContextCard(
                label: 'AI Summary',
                value:
                    'This workspace is healthy. High-confidence sources are connected, memory freshness is within SLA, and related collections are ready for retrieval.',
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        _DocumentSection(
          title: 'Recent Documents',
          subtitle: 'Latest updates used in executive reasoning',
          documents: recent,
        ),
        const SizedBox(height: AppSpacing.md),
        _DocumentSection(
          title: 'Frequently Used',
          subtitle: 'High-frequency memory artifacts',
          documents: frequent,
        ),
        const SizedBox(height: AppSpacing.md),
        _CollectionSection(
          title: 'Smart Collections',
          subtitle: 'AI-curated clusters by relevance and usage',
          items: const [
            ('Executive Briefing Pack', '14 docs · high confidence'),
            ('Operations Risk Cluster', '9 docs · active this week'),
            ('Helios Program Memory', '7 docs · strategic'),
          ],
        ),
        const SizedBox(height: AppSpacing.md),
        _DocumentSection(
          title: 'Related Knowledge',
          subtitle: 'Cross-linked context for better reasoning',
          documents: related,
        ),
      ],
    );
  }
}

class _KnowledgeRightPanel extends StatelessWidget {
  const _KnowledgeRightPanel({
    required this.selected,
    required this.model,
    required this.docCount,
    required this.sourceCount,
  });

  final AiKnowledgeBase selected;
  final AiModel model;
  final int docCount;
  final int sourceCount;

  @override
  Widget build(BuildContext context) {
    final lastSync = _relative(selected.lastSynced);
    final tokenUsed = (docCount * 640).clamp(1200, 64000);

    return ListView(
      children: [
        AiPanel(
          header: Text(
            'Memory Status',
            style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
          ),
          child: Column(
            children: [
              const AiContextCard(label: 'Memory Status', value: 'Healthy · synchronized'),
              const SizedBox(height: AppSpacing.xs),
              const AiContextCard(label: 'Embeddings Status', value: 'Indexed · up to date'),
              const SizedBox(height: AppSpacing.xs),
              const AiContextCard(label: 'Knowledge Health', value: '94% quality confidence'),
              const SizedBox(height: AppSpacing.xs),
              AiContextCard(label: 'Last Sync', value: lastSync),
              const SizedBox(height: AppSpacing.xs),
              TokenUsageIndicator(tokensUsed: tokenUsed, contextWindow: model.contextWindow),
              const SizedBox(height: AppSpacing.xs),
              AiContextCard(label: 'Connected Sources', value: '$sourceCount sources connected'),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        const AiMemoryCard(
          title: 'Executive Memory Indicators',
          summary: 'Signals influencing current retrieval and AI synthesis.',
          items: [
            'Decision style: concise action-first summaries',
            'Priority initiative: Helios rollout',
            'Risk sensitivity: North region volatility',
          ],
        ),
        const SizedBox(height: AppSpacing.md),
        AiPanel(
          header: Text(
            'Connected Sources',
            style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
          ),
          child: Column(
            children: const [
              AiContextCard(label: 'Source', value: 'Operations Manual Repository'),
              SizedBox(height: AppSpacing.xs),
              AiContextCard(label: 'Source', value: 'Grid Topology Data Lake'),
              SizedBox(height: AppSpacing.xs),
              AiContextCard(label: 'Source', value: 'Quarterly Reports Workspace'),
            ],
          ),
        ),
      ],
    );
  }

  String _relative(DateTime dt) {
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

class _DocumentSection extends StatelessWidget {
  const _DocumentSection({
    required this.title,
    required this.subtitle,
    required this.documents,
  });

  final String title;
  final String subtitle;
  final List<_KnowledgeDocument> documents;

  @override
  Widget build(BuildContext context) {
    return AiPanel(
      header: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 2),
          Text(subtitle, style: Theme.of(context).textTheme.bodySmall),
        ],
      ),
      child: documents.isEmpty
          ? const Column(
              children: [
                AiEmptyState(
                  title: 'No documents available',
                  subtitle: 'When knowledge is indexed, executive document cards will appear here.',
                  icon: Icons.description_outlined,
                ),
                SizedBox(height: AppSpacing.sm),
                AiLoadingState(lines: 2),
              ],
            )
          : Column(
              children: [
                for (final doc in documents)
                  Padding(
                    padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                    child: _KnowledgeDocumentCard(document: doc),
                  ),
              ],
            ),
    );
  }
}

class _CollectionSection extends StatelessWidget {
  const _CollectionSection({
    required this.title,
    required this.subtitle,
    required this.items,
  });

  final String title;
  final String subtitle;
  final List<(String, String)> items;

  @override
  Widget build(BuildContext context) {
    return AiPanel(
      header: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 2),
          Text(subtitle, style: Theme.of(context).textTheme.bodySmall),
        ],
      ),
      child: Column(
        children: [
          for (final item in items)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.xs),
              child: AiContextCard(label: item.$1, value: item.$2),
            ),
        ],
      ),
    );
  }
}

class _NavTile extends StatelessWidget {
  const _NavTile({
    required this.label,
    required this.icon,
    required this.count,
    required this.selected,
  });

  final String label;
  final IconData icon;
  final int count;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    return AiPanel(
      highlighted: selected,
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: AppSpacing.xs),
      child: Row(
        children: [
          Icon(icon, size: 16),
          const SizedBox(width: AppSpacing.xs),
          Expanded(child: Text(label, maxLines: 1, overflow: TextOverflow.ellipsis)),
          AiSuggestionChip(label: '$count'),
        ],
      ),
    );
  }
}

class _KnowledgeDocumentCard extends StatelessWidget {
  const _KnowledgeDocumentCard({required this.document});

  final _KnowledgeDocument document;

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
                  document.title,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
                ),
              ),
              AiSuggestionChip(
                label: '${document.confidence}% confidence',
                icon: Icons.verified_rounded,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Wrap(
            spacing: AppSpacing.xs,
            runSpacing: AppSpacing.xs,
            children: [
              for (final tag in document.tags)
                AiSuggestionChip(label: tag, icon: Icons.tag_rounded),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            document.aiSummary,
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              Expanded(
                child: AiContextCard(label: 'Last Updated', value: document.lastUpdated),
              ),
              const SizedBox(width: AppSpacing.xs),
              Expanded(child: AiContextCard(label: 'Source', value: document.source)),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.xs,
            runSpacing: AppSpacing.xs,
            children: const [
              AiSuggestionChip(label: 'Open', icon: Icons.open_in_new_rounded),
              AiSuggestionChip(label: 'Summarize', icon: Icons.auto_awesome_rounded),
              AiSuggestionChip(label: 'Pin', icon: Icons.push_pin_outlined),
            ],
          ),
        ],
      ),
    );
  }
}

class _KnowledgeDocument {
  const _KnowledgeDocument({
    required this.title,
    required this.tags,
    required this.aiSummary,
    required this.lastUpdated,
    required this.confidence,
    required this.source,
  });

  final String title;
  final List<String> tags;
  final String aiSummary;
  final String lastUpdated;
  final int confidence;
  final String source;
}
