import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../shared/widgets/responsive_layout.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../data/models/sales_models.dart';
import '../providers/sales_providers.dart';
import '../widgets/sales_widgets.dart';

class SalesCopilotPanelScreen extends HookConsumerWidget {
  const SalesCopilotPanelScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(authSessionProvider);
    if (!_hasSalesReadAccess(session)) {
      return const _SalesAccessRequired();
    }

    final leads = ref.watch(leadsProvider(const SalesPageQuery(limit: 100)));
    final contacts = ref.watch(contactsProvider(const SalesPageQuery(limit: 100)));
    final opportunities = ref.watch(opportunitiesProvider(const SalesPageQuery(limit: 100)));
    final activities = ref.watch(
      activitiesProvider(
        const SalesPageQuery(limit: 100, filters: {'type': 'MEETING'}),
      ),
    );
    final promptController = useTextEditingController();
    final isWide = currentBreakpoint(context) != AppBreakpoint.compact;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: ResponsiveLayout(
        maxContentWidth: 1320,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Sales Copilot Command Center',
              style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              'Launch AI workflows across lead qualification, messaging, meeting intelligence, and deal strategy from one workspace.',
              style: Theme.of(context).textTheme.bodyLarge,
            ),
            const SizedBox(height: AppSpacing.lg),
            SalesSectionCard(
              title: 'Copilot Guidance',
              subtitle: 'Set cross-action context for AI responses',
              child: TextField(
                controller: promptController,
                minLines: 2,
                maxLines: 4,
                decoration: const InputDecoration(
                  labelText: 'Optional copilot guidance',
                  hintText: 'Example: Focus on executive alignment risk and implementation urgency.',
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            const SalesCopilotResult(),
            const SizedBox(height: AppSpacing.lg),
            if (isWide)
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: _ActionSection<SalesLead>(
                      title: 'Lead Qualification',
                      subtitle: 'Score and prioritize inbound demand',
                      items: leads.valueOrNull?.items ?? const [],
                      labelBuilder: (lead) => lead.title,
                      onRun: (lead) => ref
                          .read(salesCopilotControllerProvider.notifier)
                          .qualifyLead(lead.id, prompt: promptController.text),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: _ActionSection<SalesContact>(
                      title: 'Email Drafting',
                      subtitle: 'Generate stakeholder-specific messaging',
                      items: contacts.valueOrNull?.items ?? const [],
                      labelBuilder: (contact) => contact.fullName,
                      onRun: (contact) => ref
                          .read(salesCopilotControllerProvider.notifier)
                          .draftEmail(contact.id, prompt: promptController.text),
                    ),
                  ),
                ],
              )
            else
              _ActionSection<SalesLead>(
                title: 'Lead Qualification',
                subtitle: 'Score and prioritize inbound demand',
                items: leads.valueOrNull?.items ?? const [],
                labelBuilder: (lead) => lead.title,
                onRun: (lead) => ref
                    .read(salesCopilotControllerProvider.notifier)
                    .qualifyLead(lead.id, prompt: promptController.text),
              ),
            const SizedBox(height: AppSpacing.md),
            if (isWide)
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: _ActionSection<SalesActivity>(
                      title: 'Meeting Summaries',
                      subtitle: 'Turn conversations into next steps',
                      items: activities.valueOrNull?.items ?? const [],
                      labelBuilder: (activity) => activity.subject,
                      onRun: (activity) => ref
                          .read(salesCopilotControllerProvider.notifier)
                          .summarizeMeeting(activity.id, prompt: promptController.text),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: _ActionSection<SalesOpportunity>(
                      title: 'Opportunity Insights',
                      subtitle: 'Analyze deal health and momentum',
                      items: opportunities.valueOrNull?.items ?? const [],
                      labelBuilder: (opportunity) => opportunity.title,
                      onRun: (opportunity) => ref
                          .read(salesCopilotControllerProvider.notifier)
                          .opportunityInsights(opportunity.id, prompt: promptController.text),
                    ),
                  ),
                ],
              )
            else ...[
              _ActionSection<SalesContact>(
                title: 'Email Drafting',
                subtitle: 'Generate stakeholder-specific messaging',
                items: contacts.valueOrNull?.items ?? const [],
                labelBuilder: (contact) => contact.fullName,
                onRun: (contact) => ref
                    .read(salesCopilotControllerProvider.notifier)
                    .draftEmail(contact.id, prompt: promptController.text),
              ),
              const SizedBox(height: AppSpacing.md),
              _ActionSection<SalesActivity>(
                title: 'Meeting Summaries',
                subtitle: 'Turn conversations into next steps',
                items: activities.valueOrNull?.items ?? const [],
                labelBuilder: (activity) => activity.subject,
                onRun: (activity) => ref
                    .read(salesCopilotControllerProvider.notifier)
                    .summarizeMeeting(activity.id, prompt: promptController.text),
              ),
              const SizedBox(height: AppSpacing.md),
              _ActionSection<SalesOpportunity>(
                title: 'Opportunity Insights',
                subtitle: 'Analyze deal health and momentum',
                items: opportunities.valueOrNull?.items ?? const [],
                labelBuilder: (opportunity) => opportunity.title,
                onRun: (opportunity) => ref
                    .read(salesCopilotControllerProvider.notifier)
                    .opportunityInsights(opportunity.id, prompt: promptController.text),
              ),
            ],
            const SizedBox(height: AppSpacing.md),
            _ActionSection<SalesOpportunity>(
              title: 'Next Best Actions',
              subtitle: 'AI playbook recommendations for each deal',
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

class _SalesAccessRequired extends StatelessWidget {
  const _SalesAccessRequired();

  @override
  Widget build(BuildContext context) {
    return const SingleChildScrollView(
      padding: EdgeInsets.all(AppSpacing.md),
      child: ResponsiveLayout(
        maxContentWidth: 980,
        child: SalesSectionCard(
          title: 'Sales Access Required',
          subtitle: 'Copilot actions are unavailable for this account.',
          child: SalesEmptyState(
            title: 'No permission to run sales copilot',
            subtitle: 'Grant sales read permissions before running qualification, drafting, and opportunity workflows.',
            icon: Icons.lock_outline_rounded,
          ),
        ),
      ),
    );
  }
}

bool _hasSalesReadAccess(dynamic session) {
  if (session == null) {
    return true;
  }

  final permissions = session?.permissions;
  if (permissions is! List<String>) {
    return false;
  }

  return permissions.any((permission) => permission.startsWith('sales.'));
}

class _ActionSection<T> extends StatefulWidget {
  const _ActionSection({
    required this.title,
    required this.subtitle,
    required this.items,
    required this.labelBuilder,
    required this.onRun,
    this.buttonLabel = 'Run',
  });

  final String title;
  final String subtitle;
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
        subtitle: widget.subtitle,
        child: const SalesEmptyState(
          title: 'No records available',
          subtitle: 'Once data is synced, this AI action can run instantly.',
          icon: Icons.hourglass_empty_rounded,
        ),
      );
    }

    selected ??= widget.items.first;

    return SalesSectionCard(
      title: widget.title,
      subtitle: widget.subtitle,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SalesRecommendationCard(
            title: 'Action Context',
            body: 'Select a record and run AI workflow.',
            icon: Icons.smart_toy_outlined,
          ),
          const SizedBox(height: AppSpacing.sm),
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
