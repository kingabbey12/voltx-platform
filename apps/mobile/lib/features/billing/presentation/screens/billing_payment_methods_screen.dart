import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../shared/widgets/async_value_view.dart';
import '../../../../shared/widgets/pull_to_refresh.dart';
import '../../../../theme/components/voltx_button.dart';
import '../../../../theme/components/voltx_card.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';
import '../../data/models/billing_models.dart';
import '../providers/billing_providers.dart';
import '../shell/billing_nav_bar.dart';

const _appReturnUrl = 'voltx://billing/payment-methods';

/// Adding a payment method opens the Stripe-hosted Customer Portal via
/// [url_launcher] rather than embedding a native card form — "Stripe
/// Checkout"/"Customer Portal" are hosted-redirect flows by design, and
/// this mirrors how the Upgrade/Dashboard screens already launch Stripe
/// URLs instead of a native Stripe SDK integration.
class BillingPaymentMethodsScreen extends ConsumerWidget {
  const BillingPaymentMethodsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final paymentMethods = ref.watch(billingPaymentMethodsProvider);
    final actionState = ref.watch(billingActionControllerProvider);

    Future<void> refresh() async {
      ref.invalidate(billingPaymentMethodsProvider);
    }

    Future<void> manageInStripe() async {
      final controller = ref.read(billingActionControllerProvider.notifier);
      final session = await controller.createPortalSession(returnUrl: _appReturnUrl);
      if (session != null) {
        await launchUrl(Uri.parse(session.url), mode: LaunchMode.externalApplication);
      }
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
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Payment Methods',
                            style: Theme.of(context)
                                .textTheme
                                .titleLarge
                                ?.copyWith(fontWeight: FontWeight.w800),
                          ),
                          Text(
                            'Manage the cards on file for your organization.',
                            style: Theme.of(context).textTheme.bodyMedium,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),
                VoltxButton(
                  label: 'Add payment method',
                  icon: Icons.add_card_outlined,
                  isExpanded: true,
                  isLoading: actionState.isLoading,
                  onPressed: manageInStripe,
                ),
                const SizedBox(height: AppSpacing.md),
                if (actionState.errorMessage != null) ...[
                  InlineErrorCard(message: actionState.errorMessage!),
                  const SizedBox(height: AppSpacing.sm),
                ],
                AsyncValueView<List<BillingPaymentMethod>>(
                  value: paymentMethods,
                  onRetry: () => ref.invalidate(billingPaymentMethodsProvider),
                  isEmpty: (list) => list.isEmpty,
                  empty: (context) => Center(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xxl),
                      child: Column(
                        children: [
                          Icon(Icons.credit_card_outlined,
                              size: 40, color: context.voltxColors.textTertiary),
                          const SizedBox(height: AppSpacing.sm),
                          const Text('No payment methods yet'),
                        ],
                      ),
                    ),
                  ),
                  data: (context, list) => Column(
                    children: [
                      for (final method in list)
                        Padding(
                          padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                          child: _PaymentMethodTile(method: method, isLoading: actionState.isLoading),
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

class _PaymentMethodTile extends ConsumerWidget {
  const _PaymentMethodTile({required this.method, required this.isLoading});

  final BillingPaymentMethod method;
  final bool isLoading;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.voltxColors;
    final controller = ref.read(billingActionControllerProvider.notifier);

    return VoltxCard(
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Icon(Icons.credit_card_rounded, color: colors.textSecondary),
              const SizedBox(width: AppSpacing.sm),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${method.brand ?? method.type} •••• ${method.last4 ?? '----'}',
                    style: Theme.of(context)
                        .textTheme
                        .bodyMedium
                        ?.copyWith(fontWeight: FontWeight.w600),
                  ),
                  if (method.expMonth != null && method.expYear != null)
                    Text(
                      'Expires ${method.expMonth!.toString().padLeft(2, '0')}/${method.expYear}',
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.textSecondary),
                    ),
                ],
              ),
            ],
          ),
          PopupMenuButton<String>(
            enabled: !isLoading,
            onSelected: (value) {
              if (value == 'default') {
                controller.setDefaultPaymentMethod(method.id);
              } else if (value == 'remove') {
                controller.removePaymentMethod(method.id);
              }
            },
            itemBuilder: (context) => [
              if (!method.isDefault)
                const PopupMenuItem(value: 'default', child: Text('Make default')),
              const PopupMenuItem(value: 'remove', child: Text('Remove')),
            ],
            child: method.isDefault
                ? Container(
                    padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs, vertical: 2),
                    decoration: BoxDecoration(
                      color: colors.surfaceMuted,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      'Default',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                            color: colors.textSecondary,
                            fontWeight: FontWeight.w700,
                          ),
                    ),
                  )
                : const Icon(Icons.more_horiz_rounded),
          ),
        ],
      ),
    );
  }
}
