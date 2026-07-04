import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../router/routes.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../shared/widgets/responsive_layout.dart';
import '../../data/models/sales_models.dart';
import '../providers/sales_providers.dart';
import '../widgets/sales_widgets.dart';

class SalesDashboardScreen extends ConsumerWidget {
  const SalesDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final companies = ref.watch(companiesProvider(const SalesPageQuery(limit: 6)));
    final contacts = ref.watch(contactsProvider(const SalesPageQuery(limit: 6)));
    final leads = ref.watch(leadsProvider(const SalesPageQuery(limit: 50)));
    final opportunities = ref.watch(opportunitiesProvider(const SalesPageQuery(limit: 50)));
    final activities = ref.watch(activitiesProvider(const SalesPageQuery(limit: 6)));
    final copilotState = ref.watch(salesCopilotControllerProvider);
    final isWide = currentBreakpoint(context) != AppBreakpoint.compact;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: ResponsiveLayout(
        maxContentWidth: 1200,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Sales Copilot',
              style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              'Track pipeline health, focus the team, and run targeted AI actions from the same workspace.',
              style: Theme.of(context).textTheme.bodyLarge,
            ),
            const SizedBox(height: AppSpacing.lg),
            Wrap(
              spacing: AppSpacing.md,
              runSpacing: AppSpacing.md,
              children: [
                SalesMetricCard(
                  label: 'Leads',
                  value: _countLabel(leads),
                  icon: Icons.group_add_rounded,
                  footnote: _topLeadStatus(leads),
                ),
                SalesMetricCard(
                  label: 'Open Opportunities',
                  value: _countLabel(opportunities),
                  icon: Icons.stacked_line_chart_rounded,
                  footnote: _activeOpportunityStage(opportunities),
                ),
                SalesMetricCard(
                  label: 'Companies',
                  value: _countLabel(companies),
                  icon: Icons.apartment_rounded,
                  footnote: 'Tracked accounts',
                ),
                SalesMetricCard(
                  label: 'Contacts',
                  value: _countLabel(contacts),
                  icon: Icons.contact_phone_rounded,
                  footnote: 'Buying committee coverage',
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.lg),
            Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.sm,
              children: [
                FilledButton.icon(
                  onPressed: () => context.go(AppRoutes.salesPipeline),
                  icon: const Icon(Icons.account_tree_outlined),
                  label: const Text('Lead Pipeline'),
                ),
                OutlinedButton.icon(
                  onPressed: () => context.go(AppRoutes.salesOpportunityBoard),
                  icon: const Icon(Icons.view_kanban_outlined),
                  label: const Text('Opportunity Board'),
                ),
                OutlinedButton.icon(
                  onPressed: () => context.go(AppRoutes.salesCopilot),
                  icon: const Icon(Icons.auto_awesome_rounded),
                  label: const Text('Open Copilot'),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.lg),
            SalesAiResultCard(
              state: copilotState,
              onClear: () => ref.read(salesCopilotControllerProvider.notifier).clear(),
            ),
            const SizedBox(height: AppSpacing.lg),
            if (isWide)
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(child: _RecentLeadsCard(leads: leads)),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(child: _RecentActivitiesCard(activities: activities)),
                ],
              )
            else ...[
              _RecentLeadsCard(leads: leads),
              const SizedBox(height: AppSpacing.md),
              _RecentActivitiesCard(activities: activities),
            ],
            const SizedBox(height: AppSpacing.md),
            if (isWide)
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(child: _CompanySnapshotCard(companies: companies)),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(child: _ContactsSnapshotCard(contacts: contacts)),
                ],
              )
            else ...[
              _CompanySnapshotCard(companies: companies),
              const SizedBox(height: AppSpacing.md),
              _ContactsSnapshotCard(contacts: contacts),
            ],
          ],
        ),
      ),
    );
  }
}

class _RecentLeadsCard extends StatelessWidget {
  const _RecentLeadsCard({required this.leads});

  final AsyncValue<PaginatedSalesResult<SalesLead>> leads;

  @override
  Widget build(BuildContext context) {
    return SalesSectionCard(
      title: 'Recent Leads',
      subtitle: 'Latest pipeline signals',
      trailing: TextButton(
        onPressed: () => context.go(AppRoutes.salesPipeline),
        child: const Text('View all'),
      ),
      child: leads.when(
        data: (page) => Column(
          children: page.items.take(5).map((lead) {
            return SalesLinkTile(
              title: lead.title,
              subtitle: '${lead.status}${lead.source != null ? ' · ${lead.source}' : ''}',
              route: AppRoutes.salesLeadDetails(lead.id),
            );
          }).toList(),
        ),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Text(error.toString()),
      ),
    );
  }
}

class _RecentActivitiesCard extends StatelessWidget {
  const _RecentActivitiesCard({required this.activities});

  final AsyncValue<PaginatedSalesResult<SalesActivity>> activities;

  @override
  Widget build(BuildContext context) {
    return SalesSectionCard(
      title: 'Recent Activities',
      subtitle: 'Latest customer interactions',
      trailing: TextButton(
        onPressed: () => context.go(AppRoutes.salesCopilot),
        child: const Text('Summarize'),
      ),
      child: activities.when(
        data: (page) => Column(
          children: page.items.map((activity) {
            return ListTile(
              contentPadding: EdgeInsets.zero,
              title: Text(activity.subject),
              subtitle: Text('${activity.type} · ${activity.completed ? 'Completed' : 'Open'}'),
            );
          }).toList(),
        ),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Text(error.toString()),
      ),
    );
  }
}

class _CompanySnapshotCard extends StatelessWidget {
  const _CompanySnapshotCard({required this.companies});

  final AsyncValue<PaginatedSalesResult<SalesCompany>> companies;

  @override
  Widget build(BuildContext context) {
    return SalesSectionCard(
      title: 'Companies',
      subtitle: 'Account coverage',
      child: companies.when(
        data: (page) => Column(
          children: page.items.map((company) {
            return SalesLinkTile(
              title: company.name,
              subtitle: company.industry ?? company.status,
              route: AppRoutes.salesCompanyDetails(company.id),
            );
          }).toList(),
        ),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Text(error.toString()),
      ),
    );
  }
}

class _ContactsSnapshotCard extends StatelessWidget {
  const _ContactsSnapshotCard({required this.contacts});

  final AsyncValue<PaginatedSalesResult<SalesContact>> contacts;

  @override
  Widget build(BuildContext context) {
    return SalesSectionCard(
      title: 'Contacts',
      subtitle: 'People closest to the deal',
      child: contacts.when(
        data: (page) => Column(
          children: page.items.map((contact) {
            return SalesLinkTile(
              title: contact.fullName,
              subtitle: contact.jobTitle ?? contact.email ?? 'Contact',
              route: AppRoutes.salesContactDetails(contact.id),
            );
          }).toList(),
        ),
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (error, _) => Text(error.toString()),
      ),
    );
  }
}

String _countLabel(AsyncValue<dynamic> asyncValue) {
  return asyncValue.maybeWhen(
    data: (data) => '${data.total}',
    orElse: () => '--',
  );
}

String _topLeadStatus(AsyncValue<PaginatedSalesResult<SalesLead>> leads) {
  return leads.maybeWhen(
    data: (page) {
      final qualified = page.items.where((lead) => lead.status == 'QUALIFIED').length;
      return '$qualified qualified in view';
    },
    orElse: () => 'Pipeline loading',
  );
}

String _activeOpportunityStage(AsyncValue<PaginatedSalesResult<SalesOpportunity>> opportunities) {
  return opportunities.maybeWhen(
    data: (page) {
      final open = page.items.where((opportunity) => !opportunity.stage.startsWith('CLOSED')).length;
      return '$open active deals';
    },
    orElse: () => 'Board loading',
  );
}
