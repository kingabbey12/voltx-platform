import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../router/routes.dart';
import '../../../../shared/widgets/responsive_layout.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../data/models/sales_models.dart';
import '../providers/sales_providers.dart';
import '../widgets/sales_widgets.dart';

class LeadDetailsScreen extends ConsumerWidget {
  const LeadDetailsScreen({required this.leadId, super.key});

  final String leadId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final lead = ref.watch(leadDetailProvider(leadId));
    final opportunities = ref.watch(
      opportunitiesProvider(
        SalesPageQuery(limit: 20, filters: {'leadId': leadId}),
      ),
    );
    final activities = ref.watch(
      activitiesProvider(
        SalesPageQuery(limit: 20, filters: {'leadId': leadId}),
      ),
    );
    final copilotState = ref.watch(salesCopilotControllerProvider);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: ResponsiveLayout(
        maxContentWidth: 1100,
        child: lead.when(
          data: (item) => Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.title,
                          style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                                fontWeight: FontWeight.w700,
                              ),
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        Text(item.source ?? 'Sales lead'),
                      ],
                    ),
                  ),
                  SalesStatusChip(item.status),
                ],
              ),
              const SizedBox(height: AppSpacing.md),
              Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                children: [
                  FilledButton.icon(
                    onPressed: () async {
                      await ref.read(salesCopilotControllerProvider.notifier).qualifyLead(item.id);
                    },
                    icon: const Icon(Icons.auto_graph_rounded),
                    label: const Text('Run qualification'),
                  ),
                  if (item.companyId != null)
                    OutlinedButton(
                      onPressed: () => context.push(AppRoutes.salesCompanyDetails(item.companyId!)),
                      child: const Text('View company'),
                    ),
                  if (item.contactId != null)
                    OutlinedButton(
                      onPressed: () => context.push(AppRoutes.salesContactDetails(item.contactId!)),
                      child: const Text('View contact'),
                    ),
                ],
              ),
              const SizedBox(height: AppSpacing.lg),
              SalesAiResultCard(
                state: copilotState,
                onClear: () => ref.read(salesCopilotControllerProvider.notifier).clear(),
              ),
              const SizedBox(height: AppSpacing.lg),
              SalesSectionCard(
                title: 'Lead Summary',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Status: ${item.status}'),
                    if (item.qualificationScore != null)
                      Text('Qualification score: ${item.qualificationScore}'),
                    if (item.notes != null) ...[
                      const SizedBox(height: AppSpacing.sm),
                      Text(item.notes!),
                    ],
                    if (item.qualificationSummary != null) ...[
                      const SizedBox(height: AppSpacing.md),
                      Text(
                        item.qualificationSummary!,
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              SalesSectionCard(
                title: 'Related Opportunities',
                child: opportunities.when(
                  data: (page) => page.items.isEmpty
                      ? const Text('No opportunities linked to this lead yet.')
                      : Column(
                          children: page.items.map((opportunity) {
                            return ListTile(
                              contentPadding: EdgeInsets.zero,
                              title: Text(opportunity.title),
                              subtitle: Text(
                                '${opportunity.stage} · ${opportunity.amount?.toStringAsFixed(0) ?? '--'} ${opportunity.currency}',
                              ),
                            );
                          }).toList(),
                        ),
                  loading: () => const Center(child: CircularProgressIndicator()),
                  error: (error, _) => Text(error.toString()),
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              SalesSectionCard(
                title: 'Related Activities',
                child: activities.when(
                  data: (page) => page.items.isEmpty
                      ? const Text('No activities linked to this lead yet.')
                      : Column(
                          children: page.items.map((activity) {
                            return ListTile(
                              contentPadding: EdgeInsets.zero,
                              title: Text(activity.subject),
                              subtitle: Text('${activity.type} · ${activity.completed ? 'Done' : 'Open'}'),
                            );
                          }).toList(),
                        ),
                  loading: () => const Center(child: CircularProgressIndicator()),
                  error: (error, _) => Text(error.toString()),
                ),
              ),
            ],
          ),
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => SalesSectionCard(
            title: 'Unable to load lead',
            child: Text(error.toString()),
          ),
        ),
      ),
    );
  }
}
