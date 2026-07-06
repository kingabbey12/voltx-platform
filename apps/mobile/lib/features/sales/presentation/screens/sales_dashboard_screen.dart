import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../router/routes.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../shared/widgets/async_value_view.dart';
import '../../../../shared/widgets/pull_to_refresh.dart';
import '../../../../shared/widgets/responsive_layout.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../data/models/sales_models.dart';
import '../providers/sales_providers.dart';
import '../widgets/sales_widgets.dart';

class SalesDashboardScreen extends ConsumerWidget {
  const SalesDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(authSessionProvider);
    if (!_hasSalesReadAccess(session)) {
      return const _SalesAccessRequired();
    }

    final companies = ref.watch(
      companiesProvider(const SalesPageQuery(limit: 6)),
    );
    final contacts = ref.watch(
      contactsProvider(const SalesPageQuery(limit: 6)),
    );
    final leads = ref.watch(leadsProvider(const SalesPageQuery(limit: 50)));
    final opportunities = ref.watch(
      opportunitiesProvider(const SalesPageQuery(limit: 50)),
    );
    final activities = ref.watch(
      activitiesProvider(const SalesPageQuery(limit: 6)),
    );
    final isWide = currentBreakpoint(context) != AppBreakpoint.compact;
    final forecast = _forecastLabel(opportunities);
    final weighted = _weightedPipelineLabel(opportunities);

    Future<void> refresh() async {
      ref.invalidate(companiesProvider);
      ref.invalidate(contactsProvider);
      ref.invalidate(leadsProvider);
      ref.invalidate(opportunitiesProvider);
      ref.invalidate(activitiesProvider);
    }

    return PullToRefresh(
      onRefresh: refresh,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(AppSpacing.md),
        child: ResponsiveLayout(
          maxContentWidth: 1320,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Sales Command Center',
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                'AI-native pipeline intelligence with revenue forecast, deal risk, and next-best-action guidance in one operating view.',
                style: Theme.of(context).textTheme.bodyLarge,
              ),
              const SizedBox(height: AppSpacing.lg),
              SalesSectionCard(
                title: 'Executive Revenue Overview',
                subtitle: 'Quarter momentum and forecast confidence',
                child: Wrap(
                  spacing: AppSpacing.md,
                  runSpacing: AppSpacing.md,
                  children: [
                    SalesMetricCard(
                      label: 'Pipeline Value',
                      value: _totalAmountLabel(opportunities),
                      icon: Icons.payments_rounded,
                      footnote: weighted,
                    ),
                    SalesMetricCard(
                      label: 'Forecast',
                      value: forecast,
                      icon: Icons.query_stats_rounded,
                      footnote: _confidenceLabel(opportunities),
                    ),
                    SalesMetricCard(
                      label: 'High Risk Deals',
                      value: _riskCountLabel(opportunities),
                      icon: Icons.warning_amber_rounded,
                      footnote: 'Probability under 40%',
                    ),
                    SalesMetricCard(
                      label: 'Next Actions Pending',
                      value: _actionGapLabel(opportunities),
                      icon: Icons.bolt_rounded,
                      footnote: 'Needs AI playbook',
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.md),
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
                    onPressed: () =>
                        context.go(AppRoutes.salesOpportunityBoard),
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
              const SalesCopilotResult(),
              const SizedBox(height: AppSpacing.lg),
              SalesSectionCard(
                title: 'AI Recommendations',
                subtitle: 'Prioritized interventions to protect forecast',
                child: _buildAiRecommendations(
                  opportunities,
                  onRetry: () => ref.invalidate(opportunitiesProvider),
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              if (isWide)
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: _RecentLeadsCard(
                        leads: leads,
                        onRetry: () => ref.invalidate(leadsProvider),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(
                      child: _RecentActivitiesCard(
                        activities: activities,
                        onRetry: () => ref.invalidate(activitiesProvider),
                      ),
                    ),
                  ],
                )
              else ...[
                _RecentLeadsCard(
                  leads: leads,
                  onRetry: () => ref.invalidate(leadsProvider),
                ),
                const SizedBox(height: AppSpacing.md),
                _RecentActivitiesCard(
                  activities: activities,
                  onRetry: () => ref.invalidate(activitiesProvider),
                ),
              ],
              const SizedBox(height: AppSpacing.md),
              if (isWide)
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      child: _CompanySnapshotCard(
                        companies: companies,
                        onRetry: () => ref.invalidate(companiesProvider),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.md),
                    Expanded(
                      child: _ContactsSnapshotCard(
                        contacts: contacts,
                        onRetry: () => ref.invalidate(contactsProvider),
                      ),
                    ),
                  ],
                )
              else ...[
                _CompanySnapshotCard(
                  companies: companies,
                  onRetry: () => ref.invalidate(companiesProvider),
                ),
                const SizedBox(height: AppSpacing.md),
                _ContactsSnapshotCard(
                  contacts: contacts,
                  onRetry: () => ref.invalidate(contactsProvider),
                ),
              ],
            ],
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
    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: const ResponsiveLayout(
        maxContentWidth: 980,
        child: SalesSectionCard(
          title: 'Sales Access Required',
          subtitle:
              'Your current account does not have sales read permissions.',
          child: SalesEmptyState(
            title: 'Unable to load sales workspace',
            subtitle:
                'Ask an administrator to grant sales permissions such as sales.company.read, sales.contact.read, sales.lead.read, sales.opportunity.read, and sales.activity.read.',
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

class _RecentLeadsCard extends StatelessWidget {
  const _RecentLeadsCard({required this.leads, this.onRetry});

  final AsyncValue<PaginatedSalesResult<SalesLead>> leads;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return SalesSectionCard(
      title: 'Recent Leads',
      subtitle: 'Qualification momentum and conversion readiness',
      trailing: TextButton(
        onPressed: () => context.go(AppRoutes.salesPipeline),
        child: const Text('View all'),
      ),
      child: leads.when(
        data: (page) => Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (page.items.isEmpty)
              const SalesEmptyState(
                title: 'No leads in motion',
                subtitle:
                    'When leads arrive, AI qualification signals will appear here.',
                icon: Icons.group_add_rounded,
              )
            else
              for (final lead in page.items.take(5))
                SalesRecommendationCard(
                  title: lead.title,
                  body:
                      '${lead.status}${lead.source != null ? ' · ${lead.source}' : ''}${lead.qualificationScore != null ? ' · score ${lead.qualificationScore}' : ''}',
                  icon: Icons.flag_rounded,
                  action: Align(
                    alignment: Alignment.centerLeft,
                    child: TextButton(
                      onPressed: () =>
                          context.push(AppRoutes.salesLeadDetails(lead.id)),
                      child: const Text('Open lead'),
                    ),
                  ),
                ),
          ],
        ),
        loading: () => const Column(
          children: [
            SalesSkeletonLine(),
            SizedBox(height: AppSpacing.sm),
            SalesSkeletonLine(),
            SizedBox(height: AppSpacing.sm),
            SalesSkeletonLine(),
          ],
        ),
        error: (error, _) => InlineErrorCard(
          message: AsyncValueView.friendlyMessageFor(error),
          onRetry: onRetry,
        ),
      ),
    );
  }
}

class _RecentActivitiesCard extends StatelessWidget {
  const _RecentActivitiesCard({required this.activities, this.onRetry});

  final AsyncValue<PaginatedSalesResult<SalesActivity>> activities;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return SalesSectionCard(
      title: 'Recent Activities',
      subtitle: 'Customer interaction timeline',
      trailing: TextButton(
        onPressed: () => context.go(AppRoutes.salesCopilot),
        child: const Text('Summarize'),
      ),
      child: activities.when(
        data: (page) => page.items.isEmpty
            ? const SalesEmptyState(
                title: 'No activity events',
                subtitle:
                    'Live interactions will populate this timeline automatically.',
                icon: Icons.history_rounded,
              )
            : Column(
                children: page.items.map((activity) {
                  return ListTile(
                    contentPadding: EdgeInsets.zero,
                    leading: Icon(
                      activity.completed
                          ? Icons.check_circle
                          : Icons.pending_actions,
                    ),
                    title: Text(activity.subject),
                    subtitle: Text(
                      '${activity.type} · ${activity.completed ? 'Completed' : 'Open'}',
                    ),
                  );
                }).toList(),
              ),
        loading: () => const Column(
          children: [
            SalesSkeletonLine(),
            SizedBox(height: AppSpacing.sm),
            SalesSkeletonLine(),
          ],
        ),
        error: (error, _) => InlineErrorCard(
          message: AsyncValueView.friendlyMessageFor(error),
          onRetry: onRetry,
        ),
      ),
    );
  }
}

class _CompanySnapshotCard extends StatelessWidget {
  const _CompanySnapshotCard({required this.companies, this.onRetry});

  final AsyncValue<PaginatedSalesResult<SalesCompany>> companies;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return SalesSectionCard(
      title: 'Companies',
      subtitle: 'Account coverage',
      child: companies.when(
        data: (page) => page.items.isEmpty
            ? const SalesEmptyState(
                title: 'No account data',
                subtitle:
                    'Add accounts to unlock territory-level intelligence.',
                icon: Icons.apartment_rounded,
              )
            : Column(
                children: page.items.map((company) {
                  return SalesLinkTile(
                    title: company.name,
                    subtitle: company.industry ?? company.status,
                    route: AppRoutes.salesCompanyDetails(company.id),
                  );
                }).toList(),
              ),
        loading: () => const SalesSkeletonLine(),
        error: (error, _) => InlineErrorCard(
          message: AsyncValueView.friendlyMessageFor(error),
          onRetry: onRetry,
        ),
      ),
    );
  }
}

class _ContactsSnapshotCard extends StatelessWidget {
  const _ContactsSnapshotCard({required this.contacts, this.onRetry});

  final AsyncValue<PaginatedSalesResult<SalesContact>> contacts;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context) {
    return SalesSectionCard(
      title: 'Contacts',
      subtitle: 'People closest to the deal',
      child: contacts.when(
        data: (page) => page.items.isEmpty
            ? const SalesEmptyState(
                title: 'No stakeholder records',
                subtitle:
                    'Stakeholder mapping appears once contacts are linked.',
                icon: Icons.contact_page_rounded,
              )
            : Column(
                children: page.items.map((contact) {
                  return SalesLinkTile(
                    title: contact.fullName,
                    subtitle: contact.jobTitle ?? contact.email ?? 'Contact',
                    route: AppRoutes.salesContactDetails(contact.id),
                  );
                }).toList(),
              ),
        loading: () => const SalesSkeletonLine(),
        error: (error, _) => InlineErrorCard(
          message: AsyncValueView.friendlyMessageFor(error),
          onRetry: onRetry,
        ),
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
      final qualified = page.items
          .where((lead) => lead.status == 'QUALIFIED')
          .length;
      return '$qualified qualified in view';
    },
    orElse: () => 'Pipeline loading',
  );
}

String _activeOpportunityStage(
  AsyncValue<PaginatedSalesResult<SalesOpportunity>> opportunities,
) {
  return opportunities.maybeWhen(
    data: (page) {
      final open = page.items
          .where((opportunity) => !opportunity.stage.startsWith('CLOSED'))
          .length;
      return '$open active deals';
    },
    orElse: () => 'Board loading',
  );
}

String _totalAmountLabel(
  AsyncValue<PaginatedSalesResult<SalesOpportunity>> opportunities,
) {
  return opportunities.maybeWhen(
    data: (page) {
      final total = page.items.fold<double>(
        0,
        (sum, item) => sum + (item.amount ?? 0),
      );
      if (total == 0) {
        return '--';
      }
      final k = total / 1000;
      return '\$${k.toStringAsFixed(0)}k';
    },
    orElse: () => '--',
  );
}

String _weightedPipelineLabel(
  AsyncValue<PaginatedSalesResult<SalesOpportunity>> opportunities,
) {
  return opportunities.maybeWhen(
    data: (page) {
      final weighted = page.items.fold<double>(
        0,
        (sum, item) => sum + ((item.amount ?? 0) * (item.probability / 100)),
      );
      return 'Weighted: \$${(weighted / 1000).toStringAsFixed(0)}k';
    },
    orElse: () => 'Weighted: --',
  );
}

String _forecastLabel(
  AsyncValue<PaginatedSalesResult<SalesOpportunity>> opportunities,
) {
  return opportunities.maybeWhen(
    data: (page) {
      final open = page.items
          .where((item) => !item.stage.startsWith('CLOSED'))
          .toList();
      if (open.isEmpty) {
        return '--';
      }
      final avgProb =
          open.fold<int>(0, (sum, item) => sum + item.probability) /
          open.length;
      return avgProb >= 70
          ? 'Strong'
          : avgProb >= 45
          ? 'Balanced'
          : 'At Risk';
    },
    orElse: () => '--',
  );
}

String _confidenceLabel(
  AsyncValue<PaginatedSalesResult<SalesOpportunity>> opportunities,
) {
  return opportunities.maybeWhen(
    data: (page) {
      final confident = page.items
          .where((item) => item.probability >= 70)
          .length;
      return '$confident high-confidence deals';
    },
    orElse: () => 'Computing confidence',
  );
}

String _riskCountLabel(
  AsyncValue<PaginatedSalesResult<SalesOpportunity>> opportunities,
) {
  return opportunities.maybeWhen(
    data: (page) =>
        '${page.items.where((item) => item.probability < 40).length}',
    orElse: () => '--',
  );
}

String _actionGapLabel(
  AsyncValue<PaginatedSalesResult<SalesOpportunity>> opportunities,
) {
  return opportunities.maybeWhen(
    data: (page) =>
        '${page.items.where((item) => item.nextBestAction == null).length}',
    orElse: () => '--',
  );
}

Widget _buildAiRecommendations(
  AsyncValue<PaginatedSalesResult<SalesOpportunity>> opportunities, {
  VoidCallback? onRetry,
}) {
  return opportunities.when(
    data: (page) {
      if (page.items.isEmpty) {
        return const SalesEmptyState(
          title: 'No opportunities yet',
          subtitle:
              'Recommendations appear once opportunities enter the pipeline.',
          icon: Icons.lightbulb_outline_rounded,
        );
      }

      final risky = page.items
          .where((item) => item.probability < 50)
          .take(3)
          .toList();
      final source = risky.isEmpty ? page.items.take(2).toList() : risky;

      return Column(
        children: source.map((item) {
          return Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.sm),
            child: SalesRecommendationCard(
              title: item.title,
              body:
                  item.nextBestAction ??
                  'Run executive alignment and reinforce value narrative before ${item.stage.replaceAll('_', ' ')}.',
              icon: Icons.psychology_alt_rounded,
              action: SalesProbabilityBar(value: item.probability),
            ),
          );
        }).toList(),
      );
    },
    loading: () => const Column(
      children: [
        SalesSkeletonLine(),
        SizedBox(height: AppSpacing.sm),
        SalesSkeletonLine(),
      ],
    ),
    error: (error, _) => InlineErrorCard(
          message: AsyncValueView.friendlyMessageFor(error),
          onRetry: onRetry,
        ),
  );
}
