import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../router/routes.dart';
import '../../../../shared/widgets/responsive_layout.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../data/models/sales_models.dart';
import '../providers/sales_providers.dart';
import '../widgets/sales_widgets.dart';

class LeadDetailsScreen extends ConsumerWidget {
  const LeadDetailsScreen({required this.leadId, super.key});

  final String leadId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(authSessionProvider);
    if (!_hasSalesReadAccess(session)) {
      return const _SalesAccessRequired();
    }

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
    final isWide = currentBreakpoint(context) != AppBreakpoint.compact;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: ResponsiveLayout(
        maxContentWidth: 1260,
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
                        if (item.qualificationScore != null) ...[
                          const SizedBox(height: AppSpacing.sm),
                          SalesProbabilityBar(value: item.qualificationScore!),
                        ],
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
                title: 'AI Lead Summary',
                subtitle: 'Qualification, risk, and conversion strategy',
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
                      SalesRecommendationCard(
                        title: 'AI Insight',
                        body: item.qualificationSummary!,
                        icon: Icons.psychology_alt_rounded,
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              if (isWide)
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: SalesSectionCard(
                        title: 'Opportunity Timeline',
                        subtitle: 'Deals linked to this lead',
                        child: opportunities.when(
                          data: (page) => page.items.isEmpty
                              ? const SalesEmptyState(
                                  title: 'No linked opportunities',
                                  subtitle: 'Create opportunities to track progression and forecast impact.',
                                  icon: Icons.timeline_rounded,
                                )
                              : Column(
                                  children: page.items.map((opportunity) {
                                    return Padding(
                                      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                                      child: SalesRecommendationCard(
                                        title: opportunity.title,
                                        body:
                                            '${opportunity.stage.replaceAll('_', ' ')} · ${opportunity.amount?.toStringAsFixed(0) ?? '--'} ${opportunity.currency}',
                                        icon: Icons.track_changes_rounded,
                                        action: SalesProbabilityBar(value: opportunity.probability),
                                      ),
                                    );
                                  }).toList(),
                                ),
                          loading: () => const SalesSkeletonLine(),
                          error: (error, _) => Text(error.toString()),
                        ),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(
                      child: SalesSectionCard(
                        title: 'Interaction History',
                        subtitle: 'Activity feed around this lead',
                        child: activities.when(
                          data: (page) => page.items.isEmpty
                              ? const SalesEmptyState(
                                  title: 'No activities logged',
                                  subtitle: 'Calls, meetings, and tasks will appear here.',
                                  icon: Icons.history_rounded,
                                )
                              : Column(
                                  children: page.items.map((activity) {
                                    return ListTile(
                                      contentPadding: EdgeInsets.zero,
                                      leading: Icon(
                                        activity.completed
                                            ? Icons.check_circle_outline_rounded
                                            : Icons.schedule_rounded,
                                      ),
                                      title: Text(activity.subject),
                                      subtitle:
                                          Text('${activity.type} · ${activity.completed ? 'Done' : 'Open'}'),
                                    );
                                  }).toList(),
                                ),
                          loading: () => const SalesSkeletonLine(),
                          error: (error, _) => Text(error.toString()),
                        ),
                      ),
                    ),
                  ],
                )
              else ...[
                SalesSectionCard(
                  title: 'Opportunity Timeline',
                  subtitle: 'Deals linked to this lead',
                  child: opportunities.when(
                    data: (page) => page.items.isEmpty
                        ? const SalesEmptyState(
                            title: 'No linked opportunities',
                            subtitle: 'Create opportunities to track progression and forecast impact.',
                            icon: Icons.timeline_rounded,
                          )
                        : Column(
                            children: page.items.map((opportunity) {
                              return Padding(
                                padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                                child: SalesRecommendationCard(
                                  title: opportunity.title,
                                  body:
                                      '${opportunity.stage.replaceAll('_', ' ')} · ${opportunity.amount?.toStringAsFixed(0) ?? '--'} ${opportunity.currency}',
                                  icon: Icons.track_changes_rounded,
                                  action: SalesProbabilityBar(value: opportunity.probability),
                                ),
                              );
                            }).toList(),
                          ),
                    loading: () => const SalesSkeletonLine(),
                    error: (error, _) => Text(error.toString()),
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                SalesSectionCard(
                  title: 'Interaction History',
                  subtitle: 'Activity feed around this lead',
                  child: activities.when(
                    data: (page) => page.items.isEmpty
                        ? const SalesEmptyState(
                            title: 'No activities logged',
                            subtitle: 'Calls, meetings, and tasks will appear here.',
                            icon: Icons.history_rounded,
                          )
                        : Column(
                            children: page.items.map((activity) {
                              return ListTile(
                                contentPadding: EdgeInsets.zero,
                                title: Text(activity.subject),
                                subtitle: Text('${activity.type} · ${activity.completed ? 'Done' : 'Open'}'),
                              );
                            }).toList(),
                          ),
                    loading: () => const SalesSkeletonLine(),
                    error: (error, _) => Text(error.toString()),
                  ),
                ),
              ],
            ],
          ),
          loading: () => const SalesSectionCard(
            title: 'Loading lead intelligence',
            child: Column(
              children: [
                SalesSkeletonLine(),
                SizedBox(height: AppSpacing.sm),
                SalesSkeletonLine(),
              ],
            ),
          ),
          error: (error, _) => SalesSectionCard(
            title: 'Unable to load lead',
            child: Text(error.toString()),
          ),
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
          subtitle: 'Lead intelligence is unavailable for this account.',
          child: SalesEmptyState(
            title: 'No permission to load lead details',
            subtitle: 'Grant sales.lead.read and sales.activity.read for full lead views.',
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
