import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../router/routes.dart';
import '../../../../shared/widgets/responsive_layout.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../data/models/sales_models.dart';
import '../providers/sales_providers.dart';
import '../widgets/sales_widgets.dart';

class CompanyDetailsScreen extends ConsumerWidget {
  const CompanyDetailsScreen({required this.companyId, super.key});

  final String companyId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final company = ref.watch(companyDetailProvider(companyId));
    final contacts = ref.watch(
      contactsProvider(SalesPageQuery(limit: 20, filters: {'companyId': companyId})),
    );
    final leads = ref.watch(
      leadsProvider(SalesPageQuery(limit: 20, filters: {'companyId': companyId})),
    );

    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: ResponsiveLayout(
        maxContentWidth: 1100,
        child: company.when(
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
                          item.name,
                          style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                                fontWeight: FontWeight.w700,
                              ),
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        Text(item.industry ?? item.domain ?? 'Sales company'),
                      ],
                    ),
                  ),
                  SalesStatusChip(item.status),
                ],
              ),
              const SizedBox(height: AppSpacing.lg),
              SalesSectionCard(
                title: 'Account Summary',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (item.website != null) Text('Website: ${item.website}'),
                    if (item.notes != null) ...[
                      const SizedBox(height: AppSpacing.sm),
                      Text(item.notes!),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              SalesSectionCard(
                title: 'Contacts',
                child: contacts.when(
                  data: (page) => page.items.isEmpty
                      ? const Text('No contacts linked to this company yet.')
                      : Column(
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
              ),
              const SizedBox(height: AppSpacing.md),
              SalesSectionCard(
                title: 'Open Leads',
                child: leads.when(
                  data: (page) => page.items.isEmpty
                      ? const Text('No leads linked to this company yet.')
                      : Column(
                          children: page.items.map((lead) {
                            return SalesLinkTile(
                              title: lead.title,
                              subtitle: lead.status,
                              route: AppRoutes.salesLeadDetails(lead.id),
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
            title: 'Unable to load company',
            child: Text(error.toString()),
          ),
        ),
      ),
    );
  }
}
