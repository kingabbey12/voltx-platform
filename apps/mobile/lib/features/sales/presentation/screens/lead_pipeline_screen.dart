import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../router/routes.dart';
import '../../../../shared/widgets/async_value_view.dart';
import '../../../../shared/widgets/empty_state.dart';
import '../../../../shared/widgets/pagination_bar.dart';
import '../../../../shared/widgets/pull_to_refresh.dart';
import '../../../../shared/widgets/responsive_layout.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../data/models/sales_models.dart';
import '../providers/sales_providers.dart';
import '../widgets/sales_widgets.dart';

final _leadsPageProvider = StateProvider<int>((ref) => 1);

class LeadPipelineScreen extends ConsumerWidget {
  const LeadPipelineScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final search = ref.watch(leadSearchProvider);
    final status = ref.watch(leadStatusFilterProvider);
    final page = ref.watch(_leadsPageProvider);
    final companies = ref.watch(
      companiesProvider(const SalesPageQuery(limit: 100)),
    );
    final contacts = ref.watch(
      contactsProvider(const SalesPageQuery(limit: 100)),
    );
    final leadsQuery = SalesPageQuery(
      page: page,
      limit: 20,
      search: search,
      filters: {'status': ?status},
    );
    final leads = ref.watch(leadsProvider(leadsQuery));
    final companyMap = {
      for (final company
          in companies.valueOrNull?.items ?? const <SalesCompany>[])
        company.id: company,
    };
    final contactMap = {
      for (final contact
          in contacts.valueOrNull?.items ?? const <SalesContact>[])
        contact.id: contact,
    };

    Future<void> refresh() async {
      ref.invalidate(companiesProvider);
      ref.invalidate(contactsProvider);
      ref.invalidate(leadsProvider);
    }

    return PullToRefresh(
      onRefresh: refresh,
      child: SingleChildScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.all(AppSpacing.md),
        child: ResponsiveLayout(
          maxContentWidth: 1200,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Lead Pipeline',
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              TextField(
                decoration: const InputDecoration(
                  prefixIcon: Icon(Icons.search_rounded),
                  hintText: 'Search leads by title, source, or notes',
                ),
                onChanged: (value) {
                  ref.read(leadSearchProvider.notifier).state = value;
                  ref.read(_leadsPageProvider.notifier).state = 1;
                },
              ),
              const SizedBox(height: AppSpacing.md),
              Wrap(
                spacing: AppSpacing.xs,
                runSpacing: AppSpacing.xs,
                children: [
                  FilterChip(
                    label: const Text('All'),
                    selected: status == null,
                    onSelected: (_) {
                      ref.read(leadStatusFilterProvider.notifier).state = null;
                      ref.read(_leadsPageProvider.notifier).state = 1;
                    },
                  ),
                  for (final value in salesLeadStatuses)
                    FilterChip(
                      label: Text(value.replaceAll('_', ' ')),
                      selected: status == value,
                      onSelected: (_) {
                        ref.read(leadStatusFilterProvider.notifier).state =
                            value;
                        ref.read(_leadsPageProvider.notifier).state = 1;
                      },
                    ),
                ],
              ),
              const SizedBox(height: AppSpacing.lg),
              const SalesCopilotResult(),
              const SizedBox(height: AppSpacing.lg),
              AsyncValueView(
                value: leads,
                onRetry: () => ref.invalidate(leadsProvider(leadsQuery)),
                isEmpty: (page) => page.items.isEmpty,
                empty: (context) => const EmptyState(
                  icon: Icons.trending_up_rounded,
                  title: 'No leads yet',
                  message: 'Leads matching your filters will appear here.',
                ),
                data: (context, page) => Column(
                  children: [
                    for (final lead in page.items) ...[
                      SalesSectionCard(
                        title: lead.title,
                        subtitle: lead.source ?? 'Sales lead',
                        trailing: SalesStatusChip(lead.status),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            if (lead.companyId != null ||
                                lead.contactId != null)
                              Text(
                                [
                                  if (lead.companyId != null &&
                                      companyMap[lead.companyId] != null)
                                    companyMap[lead.companyId]!.name,
                                  if (lead.contactId != null &&
                                      contactMap[lead.contactId] != null)
                                    contactMap[lead.contactId]!.fullName,
                                ].join(' · '),
                              ),
                            if (lead.qualificationScore != null) ...[
                              const SizedBox(height: AppSpacing.xs),
                              Text(
                                'Qualification score: ${lead.qualificationScore}',
                              ),
                            ],
                            if (lead.qualificationSummary != null) ...[
                              const SizedBox(height: AppSpacing.xs),
                              Text(
                                lead.qualificationSummary!,
                                maxLines: 3,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                            const SizedBox(height: AppSpacing.sm),
                            Wrap(
                              spacing: AppSpacing.xs,
                              runSpacing: AppSpacing.xs,
                              children: [
                                FilledButton.tonalIcon(
                                  onPressed: () async {
                                    await ref
                                        .read(
                                          salesCopilotControllerProvider
                                              .notifier,
                                        )
                                        .qualifyLead(lead.id);
                                  },
                                  icon: const Icon(Icons.auto_graph_rounded),
                                  label: const Text('Qualify'),
                                ),
                                OutlinedButton(
                                  onPressed: () => context.push(
                                    AppRoutes.salesLeadDetails(lead.id),
                                  ),
                                  child: const Text('Open details'),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: AppSpacing.md),
                    ],
                    PaginationBar(
                      page: page.page,
                      totalPages: page.totalPages,
                      onPageChanged: (p) =>
                          ref.read(_leadsPageProvider.notifier).state = p,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
