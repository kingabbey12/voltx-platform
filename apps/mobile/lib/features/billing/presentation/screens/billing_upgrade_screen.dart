import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../shared/widgets/async_value_view.dart';
import '../../../../theme/components/voltx_button.dart';
import '../../../../theme/components/voltx_card.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';
import '../../data/models/billing_models.dart';
import '../billing_format.dart';
import '../providers/billing_providers.dart';
import '../shell/billing_nav_bar.dart';

const _checkoutSuccessUrl = 'voltx://billing?checkout=success';
const _checkoutCancelUrl = 'voltx://billing/upgrade?checkout=cancelled';

class BillingUpgradeScreen extends ConsumerStatefulWidget {
  const BillingUpgradeScreen({super.key});

  @override
  ConsumerState<BillingUpgradeScreen> createState() => _BillingUpgradeScreenState();
}

class _BillingUpgradeScreenState extends ConsumerState<BillingUpgradeScreen> {
  int _seats = 1;
  String? _pendingPlanKey;

  Future<void> _choosePlan(BillingPlan plan, BillingSubscription subscription) async {
    setState(() => _pendingPlanKey = plan.key);
    final controller = ref.read(billingActionControllerProvider.notifier);

    try {
      if (subscription.stripeSubscriptionId == null) {
        final session = await controller.createCheckoutSession(
          planKey: plan.key,
          seats: _seats,
          successUrl: _checkoutSuccessUrl,
          cancelUrl: _checkoutCancelUrl,
        );
        if (session != null) {
          await launchUrl(Uri.parse(session.url), mode: LaunchMode.externalApplication);
        }
        return;
      }

      final plans = ref.read(billingPlansProvider).valueOrNull ?? [];
      final currentPlan = plans.firstWhere(
        (p) => p.id == subscription.planId,
        orElse: () => plan,
      );
      if (plan.sortOrder > currentPlan.sortOrder) {
        await controller.upgrade(plan.key, seats: _seats);
      } else {
        await controller.downgrade(plan.key, seats: _seats);
      }

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Switched to the ${plan.name} plan.')),
        );
      }
    } finally {
      if (mounted) setState(() => _pendingPlanKey = null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final plans = ref.watch(billingPlansProvider);
    final subscription = ref.watch(billingSubscriptionProvider);
    final actionState = ref.watch(billingActionControllerProvider);

    return Column(
      children: [
        const BillingNavBar(),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(AppSpacing.md),
            children: [
              Text(
                'Upgrade',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                'Compare plans and pick the one that fits your team.',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: AppSpacing.md),
              VoltxCard(
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Seats',
                          style: Theme.of(context)
                              .textTheme
                              .bodyMedium
                              ?.copyWith(fontWeight: FontWeight.w700),
                        ),
                        Text(
                          'How many teammates need access',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ),
                    Row(
                      children: [
                        IconButton(
                          onPressed: () => setState(() => _seats = _seats > 1 ? _seats - 1 : 1),
                          icon: const Icon(Icons.remove_circle_outline),
                        ),
                        Text('$_seats', style: Theme.of(context).textTheme.titleMedium),
                        IconButton(
                          onPressed: () => setState(() => _seats += 1),
                          icon: const Icon(Icons.add_circle_outline),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              if (actionState.errorMessage != null) ...[
                InlineErrorCard(message: actionState.errorMessage!),
                const SizedBox(height: AppSpacing.sm),
              ],
              AsyncValueView<List<BillingPlan>>(
                value: plans,
                onRetry: () => ref.invalidate(billingPlansProvider),
                data: (context, planList) => subscription.when(
                  data: (sub) => Column(
                    children: [
                      for (final plan in planList)
                        Padding(
                          padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                          child: _PlanCard(
                            plan: plan,
                            isCurrent: plan.id == sub.planId,
                            isLoading: actionState.isLoading && _pendingPlanKey == plan.key,
                            onChoose: () => _choosePlan(plan, sub),
                          ),
                        ),
                    ],
                  ),
                  loading: () => const Center(child: CircularProgressIndicator()),
                  error: (error, _) => InlineErrorCard(message: AsyncValueView.friendlyMessageFor(error)),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _PlanCard extends StatelessWidget {
  const _PlanCard({
    required this.plan,
    required this.isCurrent,
    required this.isLoading,
    required this.onChoose,
  });

  final BillingPlan plan;
  final bool isCurrent;
  final bool isLoading;
  final VoidCallback onChoose;

  @override
  Widget build(BuildContext context) {
    final colors = context.voltxColors;
    final isEnterprise = plan.priceMonthlyUsd == null;

    return VoltxCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                plan.name,
                style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
              ),
              if (isCurrent)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs, vertical: 2),
                  decoration: BoxDecoration(
                    color: Theme.of(context).colorScheme.primary.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    'Current plan',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: Theme.of(context).colorScheme.primary,
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                ),
            ],
          ),
          Text(
            isEnterprise ? 'Contact us' : '${formatBillingCurrency(plan.priceMonthlyUsd!)}/mo per seat',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.textSecondary),
          ),
          const SizedBox(height: AppSpacing.sm),
          for (final limit in (plan.limits ?? const []).take(5))
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.xxs),
              child: Row(
                children: [
                  Icon(Icons.check_circle_outline,
                      size: 16, color: Theme.of(context).colorScheme.primary),
                  const SizedBox(width: AppSpacing.xxs),
                  Expanded(
                    child: Text(
                      limit.limit == null
                          ? 'Unlimited ${billingFeatureLabel(limit.featureKey).toLowerCase()}'
                          : '${formatBillingQuantity(limit.limit!, limit.unit)} ${billingFeatureLabel(limit.featureKey).toLowerCase()}',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ),
                ],
              ),
            ),
          const SizedBox(height: AppSpacing.sm),
          VoltxButton(
            label: isCurrent ? 'Current plan' : (isEnterprise ? 'Contact sales' : 'Choose plan'),
            isExpanded: true,
            isLoading: isLoading,
            variant: isCurrent ? VoltxButtonVariant.secondary : VoltxButtonVariant.primary,
            onPressed: (isCurrent || isEnterprise) ? null : onChoose,
          ),
        ],
      ),
    );
  }
}
