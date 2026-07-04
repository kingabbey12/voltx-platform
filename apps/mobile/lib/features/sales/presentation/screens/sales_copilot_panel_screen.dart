import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../shared/widgets/responsive_layout.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../data/models/sales_models.dart';
import '../providers/sales_providers.dart';
import '../widgets/sales_widgets.dart';

class SalesCopilotPanelScreen extends HookConsumerWidget {
  const SalesCopilotPanelScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final leads = ref.watch(leadsProvider(const SalesPageQuery(limit: 100)));
    final contacts = ref.watch(contactsProvider(const SalesPageQuery(limit: 100)));
    final opportunities = ref.watch(opportunitiesProvider(const SalesPageQuery(limit: 100)));
    final activities = ref.watch(
      activitiesProvider(
        const SalesPageQuery(limit: 100, filters: {'type': 'MEETING'}),
      ),
    );
    final copilotState = ref.watch(salesCopilotControllerProvider);
    final promptController = useTextEditingController();

    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: ResponsiveLayout(
        maxContentWidth: 1200,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'AI Copilot Panel',
              style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              'Run qualification, drafting, meeting, and opportunity actions against live sales records.',
              style: Theme.of(context).textTheme.bodyLarge,
            ),
            const SizedBox(height: AppSpacing.lg),
            TextField(
              controller: promptController,
              minLines: 2,
              maxLines: 4,
              decoration: const InputDecoration(
                labelText: 'Optional copilot guidance',
                hintText: 'Example: Focus on executive alignment risk and implementation urgency.',
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            SalesAiResultCard(
              state: copilotState,
              onClear: () => ref.read(salesCopilotControllerProvider.notifier).clear(),
            ),
            const SizedBox(height: AppSpacing.lg),
            _ActionSection<SalesLead>(
              title: 'Lead Qualification',
              items: leads.valueOrNull?.items ?? const [],
              labelBuilder: (lead) => lead.title,
              onRun: (lead) => ref
                  .read(salesCopilotControllerProvider.notifier)
                  .qualifyLead(lead.id, prompt: promptController.text),
            ),
            const SizedBox(height: AppSpacing.md),
            _ActionSection<SalesContact>(
              title: 'Email Drafting',
              items: contacts.valueOrNull?.items ?? const [],
              labelBuilder: (contact) => contact.fullName,
              onRun: (contact) => ref
                  .read(salesCopilotControllerProvider.notifier)
                  .draftEmail(contact.id, prompt: promptController.text),
            ),
            const SizedBox(height: AppSpacing.md),
            _ActionSection<SalesActivity>(
              title: 'Meeting Summaries',
              items: activities.valueOrNull?.items ?? const [],
              labelBuilder: (activity) => activity.subject,
              onRun: (activity) => ref
                  .read(salesCopilotControllerProvider.notifier)
                  .summarizeMeeting(activity.id, prompt: promptController.text),
            ),
            const SizedBox(height: AppSpacing.md),
            _ActionSection<SalesOpportunity>(
              title: 'Opportunity Insights',
              items: opportunities.valueOrNull?.items ?? const [],
              labelBuilder: (opportunity) => opportunity.title,
              onRun: (opportunity) => ref
                  .read(salesCopilotControllerProvider.notifier)
                  .opportunityInsights(opportunity.id, prompt: promptController.text),
            ),
            const SizedBox(height: AppSpacing.md),
            _ActionSection<SalesOpportunity>(
              title: 'Next-Best-Action Recommendations',
              items: opportunities.valueOrNull?.items ?? const [],
              labelBuilder: (opportunity) => opportunity.title,
              buttonLabel: 'Recommend',
              onRun: (opportunity) => ref
                  .read(salesCopilotControllerProvider.notifier)
                  .nextBestAction(opportunity.id, prompt: promptController.text),
            ),
          ],
        ),
      ),
    );
  }
}

class _ActionSection<T> extends StatefulWidget {
  const _ActionSection({
    required this.title,
    required this.items,
    required this.labelBuilder,
    required this.onRun,
    this.buttonLabel = 'Run',
  });

  final String title;
  final List<T> items;
  final String Function(T value) labelBuilder;
  final Future<void> Function(T value) onRun;
  final String buttonLabel;

  @override
  State<_ActionSection<T>> createState() => _ActionSectionState<T>();
}

class _ActionSectionState<T> extends State<_ActionSection<T>> {
  T? selected;

  @override
  void didUpdateWidget(covariant _ActionSection<T> oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.items.isNotEmpty && !widget.items.contains(selected)) {
      selected = widget.items.first;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (widget.items.isEmpty) {
      return SalesSectionCard(
        title: widget.title,
        child: const Text('No records available for this action yet.'),
      );
    }

    selected ??= widget.items.first;

    return SalesSectionCard(
      title: widget.title,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          DropdownButtonFormField<T>(
            initialValue: selected,
            items: widget.items
                .map(
                  (item) => DropdownMenuItem<T>(
                    value: item,
                    child: Text(widget.labelBuilder(item)),
                  ),
                )
                .toList(),
            onChanged: (value) => setState(() => selected = value),
          ),
          const SizedBox(height: AppSpacing.sm),
          FilledButton.tonalIcon(
            onPressed: selected == null ? null : () => widget.onRun(selected as T),
            icon: const Icon(Icons.auto_awesome_rounded),
            label: Text(widget.buttonLabel),
          ),
        ],
      ),
    );
  }
}
