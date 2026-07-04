import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../router/routes.dart';
import '../../../../shared/widgets/responsive_layout.dart';
import '../../../../theme/tokens/spacing.dart';
import '../providers/sales_providers.dart';
import '../widgets/sales_widgets.dart';
import '../../data/models/sales_models.dart';

class ContactDetailsScreen extends ConsumerWidget {
  const ContactDetailsScreen({required this.contactId, super.key});

  final String contactId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final contact = ref.watch(contactDetailProvider(contactId));
    final leads = ref.watch(
      leadsProvider(SalesPageQuery(limit: 20, filters: {'contactId': contactId})),
    );
    final opportunities = ref.watch(
      opportunitiesProvider(SalesPageQuery(limit: 20, filters: {'contactId': contactId})),
    );
    final copilotState = ref.watch(salesCopilotControllerProvider);

    return SingleChildScrollView(
      padding: const EdgeInsets.all(AppSpacing.md),
      child: ResponsiveLayout(
        maxContentWidth: 1100,
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
                title: 'Contact Summary',
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (item.email != null) Text('Email: ${item.email}'),
                    if (item.phone != null) Text('Phone: ${item.phone}'),
                    if (item.notes != null) ...[
                      const SizedBox(height: AppSpacing.sm),
                      Text(item.notes!),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              SalesSectionCard(
                title: 'Related Leads',
                child: leads.when(
                  data: (page) => page.items.isEmpty
                      ? const Text('No leads linked to this contact yet.')
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
              const SizedBox(height: AppSpacing.md),
              SalesSectionCard(
                title: 'Related Opportunities',
                child: opportunities.when(
                  data: (page) => page.items.isEmpty
                      ? const Text('No opportunities linked to this contact yet.')
                      : Column(
                          children: page.items.map((opportunity) {
                            return ListTile(
                              contentPadding: EdgeInsets.zero,
                              title: Text(opportunity.title),
                              subtitle: Text(opportunity.stage),
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
            title: 'Unable to load contact',
            child: Text(error.toString()),
          ),
        ),
      ),
    );
  }
}
