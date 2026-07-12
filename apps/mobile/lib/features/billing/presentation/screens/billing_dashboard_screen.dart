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
import '../billing_format.dart';
import '../providers/billing_providers.dart';
import '../shell/billing_nav_bar.dart';

const _appReturnUrl = 'voltx://billing';

class BillingDashboardScreen extends ConsumerWidget {
  const BillingDashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final subscription = ref.watch(billingSubscriptionProvider);
    final plans = ref.watch(billingPlansProvider);
    final usage = ref.watch(billingUsageProvider);
    final actionState = ref.watch(billingActionControllerProvider);

    Future<void> refresh() async {
      ref.invalidate(billingSubscriptionProvider);
      ref.invalidate(billingUsageProvider);
    }

    Future<void> manageBilling() async {
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
                    Text(
                      'Billing',
                      style: Theme.of(context)
                          .textTheme
                          .titleLarge
                          ?.copyWith(fontWeight: FontWeight.w800),
                    ),
                    VoltxButton(
                      label: 'Manage in Stripe',
                      icon: Icons.credit_card_outlined,
                      variant: VoltxButtonVariant.secondary,
                      isLoading: actionState.isLoading,
                      onPressed: manageBilling,
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),
                if (actionState.errorMessage != null) ...[
                  InlineErrorCard(message: actionState.errorMessage!),
                  const SizedBox(height: AppSpacing.sm),
                ],
                AsyncValueView<BillingSubscription>(
                  value: subscription,
                  onRetry: () => ref.invalidate(billingSubscriptionProvider),
                  data: (context, sub) {
                    final planName = plans.maybeWhen(
                      data: (list) => list
                          .firstWhere(
                            (p) => p.id == sub.planId,
                            orElse: () => const BillingPlan(
                              id: '',
                              key: '',
                              name: 'Current plan',
                              sortOrder: 0,
                              trialDays: 0,
                            ),
                          )
                          .name,
                      orElse: () => 'Current plan',
                    );

                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (sub.cancelAtPeriodEnd)
                          Padding(
                            padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                            child: VoltxCard(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Your subscription ends ${formatBillingDate(sub.currentPeriodEnd)}',
                                    style: Theme.of(context)
                                        .textTheme
                                        .titleSmall
                                        ?.copyWith(fontWeight: FontWeight.w700),
                                  ),
                                  const SizedBox(height: AppSpacing.xxs),
                                  Text(
                                    'Resume any time before then to keep this plan.',
                                    style: Theme.of(context).textTheme.bodySmall,
                                  ),
                                  const SizedBox(height: AppSpacing.sm),
                                  VoltxButton(
                                    label: 'Resume subscription',
                                    isLoading: actionState.isLoading,
                                    onPressed: () =>
                                        ref.read(billingActionControllerProvider.notifier).resume(),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        VoltxCard(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    planName,
                                    style: Theme.of(context)
                                        .textTheme
                                        .titleMedium
                                        ?.copyWith(fontWeight: FontWeight.w700),
                                  ),
                                  _StatusBadge(status: sub.status),
                                ],
                              ),
                              const SizedBox(height: AppSpacing.xxs),
                              Text(
                                '${sub.seats} seat${sub.seats == 1 ? '' : 's'}',
                                style: Theme.of(context).textTheme.bodyMedium,
                              ),
                              if (sub.status == 'TRIALING' && sub.trialEnd != null) ...[
                                const SizedBox(height: AppSpacing.xxs),
                                Text(
                                  'Trial ends ${formatBillingDate(sub.trialEnd!)}',
                                  style: Theme.of(context).textTheme.bodySmall,
                                ),
                              ],
                            ],
                          ),
                        ),
                      ],
                    );
                  },
                ),
                const SizedBox(height: AppSpacing.md),
                Text(
                  'Usage this period',
                  style:
                      Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: AppSpacing.sm),
                AsyncValueView<List<BillingFeatureUsage>>(
                  value: usage,
                  onRetry: () => ref.invalidate(billingUsageProvider),
                  isEmpty: (list) => list.isEmpty,
                  empty: (context) => const SizedBox.shrink(),
                  data: (context, list) => VoltxCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        for (var i = 0; i < list.length; i++) ...[
                          _UsageRow(usage: list[i]),
                          if (i != list.length - 1) const SizedBox(height: AppSpacing.sm),
                        ],
                      ],
                    ),
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

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final colors = context.voltxColors;
    final (color, surface) = switch (status) {
      'ACTIVE' => (colors.success, colors.successSurface),
      'TRIALING' => (colors.warning, colors.warningSurface),
      _ => (colors.error, colors.errorSurface),
    };

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs, vertical: 2),
      decoration: BoxDecoration(color: surface, borderRadius: BorderRadius.circular(999)),
      child: Text(
        status,
        style: Theme.of(context)
            .textTheme
            .labelSmall
            ?.copyWith(color: color, fontWeight: FontWeight.w700),
      ),
    );
  }
}

class _UsageRow extends StatelessWidget {
  const _UsageRow({required this.usage});

  final BillingFeatureUsage usage;

  @override
  Widget build(BuildContext context) {
    final colors = context.voltxColors;
    final limit = usage.limit;
    final percent = (limit == null || limit == 0)
        ? 0.0
        : (usage.currentUsage / limit).clamp(0, 1).toDouble();
    final nearLimit = limit != null && percent >= 0.8;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              billingFeatureLabel(usage.featureKey),
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
            ),
            Text(
              limit != null
                  ? '${formatBillingQuantity(usage.currentUsage, usage.unit)} / ${formatBillingQuantity(limit, usage.unit)}'
                  : '${formatBillingQuantity(usage.currentUsage, usage.unit)} · Unlimited',
              style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.textSecondary),
            ),
          ],
        ),
        if (limit != null) ...[
          const SizedBox(height: AppSpacing.xxs),
          ClipRRect(
            borderRadius: BorderRadius.circular(999),
            child: LinearProgressIndicator(
              value: percent,
              minHeight: 6,
              backgroundColor: colors.surfaceMuted,
              valueColor: AlwaysStoppedAnimation(
                nearLimit ? colors.warning : Theme.of(context).colorScheme.primary,
              ),
            ),
          ),
        ],
      ],
    );
  }
}
