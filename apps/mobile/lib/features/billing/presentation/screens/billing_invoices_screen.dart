import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../shared/widgets/async_value_view.dart';
import '../../../../shared/widgets/pagination_bar.dart';
import '../../../../shared/widgets/pull_to_refresh.dart';
import '../../../../theme/components/voltx_card.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';
import '../../data/models/billing_models.dart';
import '../billing_format.dart';
import '../providers/billing_providers.dart';
import '../shell/billing_nav_bar.dart';

class BillingInvoicesScreen extends ConsumerWidget {
  const BillingInvoicesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final page = ref.watch(billingInvoicesPageProvider);
    final invoices = ref.watch(billingInvoicesProvider(page));

    Future<void> refresh() async {
      ref.invalidate(billingInvoicesProvider);
    }

    return Column(
      children: [
        const BillingNavBar(),
        Expanded(
          child: PullToRefresh(
            onRefresh: refresh,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(AppSpacing.md),
              children: [
                Text(
                  'Invoices',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  'Billing history for your organization.',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: AppSpacing.md),
                AsyncValueView<PaginatedBillingResult<BillingInvoice>>(
                  value: invoices,
                  onRetry: () => ref.invalidate(billingInvoicesProvider),
                  isEmpty: (result) => result.items.isEmpty,
                  empty: (context) => Center(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xxl),
                      child: Column(
                        children: [
                          Icon(Icons.receipt_long_outlined,
                              size: 40, color: context.voltxColors.textTertiary),
                          const SizedBox(height: AppSpacing.sm),
                          const Text('No invoices yet'),
                        ],
                      ),
                    ),
                  ),
                  data: (context, result) => Column(
                    children: [
                      for (final invoice in result.items)
                        Padding(
                          padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                          child: _InvoiceTile(invoice: invoice),
                        ),
                      PaginationBar(
                        page: result.page,
                        totalPages: result.totalPages,
                        onPageChanged: (p) => ref.read(billingInvoicesPageProvider.notifier).state = p,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _InvoiceTile extends StatelessWidget {
  const _InvoiceTile({required this.invoice});

  final BillingInvoice invoice;

  @override
  Widget build(BuildContext context) {
    final colors = context.voltxColors;
    final url = invoice.pdfUrl ?? invoice.hostedInvoiceUrl;
    final (statusColor, statusSurface) = switch (invoice.status) {
      'PAID' => (colors.success, colors.successSurface),
      'OPEN' => (colors.warning, colors.warningSurface),
      'UNCOLLECTIBLE' => (colors.error, colors.errorSurface),
      _ => (colors.textSecondary, colors.surfaceMuted),
    };

    return VoltxCard(
      onTap: url != null ? () => launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication) : null,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                formatBillingDate(invoice.createdAt),
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: AppSpacing.xxs),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs, vertical: 1),
                decoration:
                    BoxDecoration(color: statusSurface, borderRadius: BorderRadius.circular(999)),
                child: Text(
                  invoice.status,
                  style: Theme.of(context)
                      .textTheme
                      .labelSmall
                      ?.copyWith(color: statusColor, fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ),
          Row(
            children: [
              Text(
                formatBillingCurrency(invoice.amountDue, currency: invoice.currency),
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
              ),
              if (url != null) ...[
                const SizedBox(width: AppSpacing.xs),
                Icon(Icons.open_in_new_rounded, size: 16, color: colors.textSecondary),
              ],
            ],
          ),
        ],
      ),
    );
  }
}
