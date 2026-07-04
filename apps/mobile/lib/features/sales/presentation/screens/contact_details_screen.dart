import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../router/routes.dart';
import '../../../../shared/widgets/responsive_layout.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../providers/sales_providers.dart';
import '../widgets/sales_widgets.dart';
import '../../data/models/sales_models.dart';

class ContactDetailsScreen extends ConsumerWidget {
  const ContactDetailsScreen({required this.contactId, super.key});

  final String contactId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(authSessionProvider);
    if (!_hasSalesReadAccess(session)) {
      return const _SalesAccessRequired();
    }

    final contact = ref.watch(contactDetailProvider(contactId));
    final leads = ref.watch(
      leadsProvider(SalesPageQuery(limit: 20, filters: {'contactId': contactId})),
    );
    final opportunities = ref.watch(
      opportunitiesProvider(SalesPageQuery(limit: 20, filters: {'contactId': contactId})),
    );
    final copilotState = ref.watch(salesCopilotControllerProvider);
    final isWide = currentBreakpoint(context) != AppBreakpoint.compact;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: ResponsiveLayout(
        maxContentWidth: 1260,
        child: contact.when(
          data: (item) => Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                item.fullName,
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                      fontWeight: FontWeight.w700,
                    ),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(item.jobTitle ?? item.email ?? 'Sales contact'),
              const SizedBox(height: AppSpacing.sm),
              SalesSectionCard(
                title: 'Relationship Health',
                subtitle: 'Engagement strength and coverage',
                child: LayoutBuilder(
                  builder: (context, constraints) {
                    final compactMetrics = constraints.maxWidth < 560;

                    final leadsCard = SalesMetricCard(
                      label: 'Linked Leads',
                      value: leads.maybeWhen(data: (data) => '${data.total}', orElse: () => '--'),
                      icon: Icons.group_outlined,
                      footnote: 'Qualification stream',
                    );

                    final dealsCard = SalesMetricCard(
                      label: 'Linked Deals',
                      value: opportunities.maybeWhen(data: (data) => '${data.total}', orElse: () => '--'),
                      icon: Icons.stacked_line_chart_rounded,
                      footnote: 'Opportunity influence',
                    );

                    if (compactMetrics) {
                      return Column(
                        children: [
                          leadsCard,
                          const SizedBox(height: AppSpacing.sm),
                          dealsCard,
                        ],
                      );
                    }

                    return Row(
                      children: [
                        Expanded(child: leadsCard),
                        const SizedBox(width: AppSpacing.sm),
                        Expanded(child: dealsCard),
                      ],
                    );
                  },
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              Wrap(
                spacing: AppSpacing.sm,
                runSpacing: AppSpacing.sm,
                children: [
                  FilledButton.icon(
                    onPressed: () async {
                      await ref.read(salesCopilotControllerProvider.notifier).draftEmail(item.id);
                    },
                    icon: const Icon(Icons.email_outlined),
                    label: const Text('Draft email'),
                  ),
                  if (item.companyId != null)
                    OutlinedButton(
                      onPressed: () => context.push(AppRoutes.salesCompanyDetails(item.companyId!)),
                      child: const Text('View company'),
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
                title: 'Customer Interaction History',
                subtitle: 'Channels, notes, and relationship context',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (item.email != null) Text('Email: ${item.email}'),
                    if (item.phone != null) Text('Phone: ${item.phone}'),
                    if (item.notes != null) ...[
                      const SizedBox(height: AppSpacing.sm),
                      SalesRecommendationCard(
                        title: 'Context Note',
                        body: item.notes!,
                        icon: Icons.description_outlined,
                      ),
                    ],
                    if (item.notes == null)
                      const SalesEmptyState(
                        title: 'No interaction notes',
                        subtitle: 'Capture meeting context here to improve AI recommendations.',
                        icon: Icons.history_edu_outlined,
                      ),
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
                        title: 'Related Leads',
                        subtitle: 'Open and qualified threads',
                        child: leads.when(
                          data: (page) => page.items.isEmpty
                              ? const SalesEmptyState(
                                  title: 'No leads linked yet',
                                  subtitle: 'Link leads to this contact to track conversion influence.',
                                  icon: Icons.link_off_rounded,
                                )
                              : Column(
                                  children: page.items.map((lead) {
                                    return SalesRecommendationCard(
                                      title: lead.title,
                                      body: lead.status,
                                      icon: Icons.flag_outlined,
                                      action: Align(
                                        alignment: Alignment.centerLeft,
                                        child: TextButton(
                                          onPressed: () => context.push(AppRoutes.salesLeadDetails(lead.id)),
                                          child: const Text('Open lead'),
                                        ),
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
                        title: 'Related Opportunities',
                        subtitle: 'Deal influence and probability',
                        child: opportunities.when(
                          data: (page) => page.items.isEmpty
                              ? const SalesEmptyState(
                                  title: 'No opportunities linked',
                                  subtitle: 'Attach opportunities to reveal deal probability context.',
                                  icon: Icons.assessment_outlined,
                                )
                              : Column(
                                  children: page.items.map((opportunity) {
                                    return SalesRecommendationCard(
                                      title: opportunity.title,
                                      body: opportunity.stage.replaceAll('_', ' '),
                                      icon: Icons.stacked_line_chart_rounded,
                                      action: SalesProbabilityBar(value: opportunity.probability),
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
                  title: 'Related Leads',
                  subtitle: 'Open and qualified threads',
                  child: leads.when(
                    data: (page) => page.items.isEmpty
                        ? const SalesEmptyState(
                            title: 'No leads linked yet',
                            subtitle: 'Link leads to this contact to track conversion influence.',
                            icon: Icons.link_off_rounded,
                          )
                        : Column(
                            children: page.items.map((lead) {
                              return SalesRecommendationCard(
                                title: lead.title,
                                body: lead.status,
                                icon: Icons.flag_outlined,
                                action: Align(
                                  alignment: Alignment.centerLeft,
                                  child: TextButton(
                                    onPressed: () => context.push(AppRoutes.salesLeadDetails(lead.id)),
                                    child: const Text('Open lead'),
                                  ),
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
                  title: 'Related Opportunities',
                  subtitle: 'Deal influence and probability',
                  child: opportunities.when(
                    data: (page) => page.items.isEmpty
                        ? const SalesEmptyState(
                            title: 'No opportunities linked',
                            subtitle: 'Attach opportunities to reveal deal probability context.',
                            icon: Icons.assessment_outlined,
                          )
                        : Column(
                            children: page.items.map((opportunity) {
                              return SalesRecommendationCard(
                                title: opportunity.title,
                                body: opportunity.stage.replaceAll('_', ' '),
                                icon: Icons.stacked_line_chart_rounded,
                                action: SalesProbabilityBar(value: opportunity.probability),
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
            title: 'Loading contact intelligence',
            child: SalesSkeletonLine(),
          ),
          error: (error, _) => SalesSectionCard(
            title: 'Unable to load contact',
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
          subtitle: 'Contact intelligence is unavailable for this account.',
          child: SalesEmptyState(
            title: 'No permission to load contact details',
            subtitle: 'Grant sales.contact.read and sales.opportunity.read for full contact views.',
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
