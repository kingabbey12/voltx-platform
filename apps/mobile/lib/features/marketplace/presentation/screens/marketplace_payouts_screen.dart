import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../shared/widgets/async_value_view.dart';
import '../../../../theme/components/voltx_card.dart';
import '../../../../theme/components/voltx_snackbar.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';
import '../../data/models/marketplace_models.dart';
import '../providers/marketplace_providers.dart';
import '../shell/marketplace_nav_bar.dart';

class MarketplacePayoutsScreen extends ConsumerWidget {
  const MarketplacePayoutsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final status = ref.watch(connectStatusProvider);
    final actionState = ref.watch(marketplaceActionControllerProvider);

    return Column(
      children: [
        const MarketplaceNavBar(),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(AppSpacing.md),
            children: [
              Text(
                'Payouts',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                'Connect Stripe to receive payouts from paid app installs.',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: AppSpacing.md),
              AsyncValueView<DeveloperConnectStatus>(
                value: status,
                onRetry: () => ref.invalidate(connectStatusProvider),
                data: (context, result) {
                  final colors = context.voltxColors;
                  final (color, surface, label) = switch (result.onboardingStatus) {
                    'COMPLETE' => (colors.success, colors.successSurface, 'Connected'),
                    'ONBOARDING' => (colors.warning, colors.warningSurface, 'Onboarding in progress'),
                    _ => (colors.textSecondary, colors.surfaceMuted, 'Not connected'),
                  };
                  return VoltxCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs, vertical: 2),
                              decoration: BoxDecoration(color: surface, borderRadius: BorderRadius.circular(999)),
                              child: Text(
                                label,
                                style: TextStyle(color: color, fontWeight: FontWeight.w700),
                              ),
                            ),
                            const Spacer(),
                            Icon(
                              result.payoutsEnabled ? Icons.check_circle_rounded : Icons.cancel_outlined,
                              color: result.payoutsEnabled ? colors.success : colors.textTertiary,
                              size: 18,
                            ),
                            const SizedBox(width: AppSpacing.xxs),
                            Text(result.payoutsEnabled ? 'Payouts enabled' : 'Payouts not yet enabled'),
                          ],
                        ),
                        const SizedBox(height: AppSpacing.md),
                        if (actionState.errorMessage != null) ...[
                          InlineErrorCard(message: actionState.errorMessage!),
                          const SizedBox(height: AppSpacing.sm),
                        ],
                        FilledButton.icon(
                          onPressed: actionState.isLoading ? null : () => _startOnboarding(context, ref),
                          icon: const Icon(Icons.account_balance_outlined),
                          label: Text(result.onboardingStatus == 'COMPLETE'
                              ? 'Manage Stripe account'
                              : 'Continue Stripe onboarding'),
                        ),
                      ],
                    ),
                  );
                },
              ),
            ],
          ),
        ),
      ],
    );
  }

  Future<void> _startOnboarding(BuildContext context, WidgetRef ref) async {
    final url = await ref.read(marketplaceActionControllerProvider.notifier).createOnboardingLink();
    if (!context.mounted) return;
    if (url == null) {
      showVoltxSnackbar(
        context,
        message:
            ref.read(marketplaceActionControllerProvider).errorMessage ?? 'Unable to start onboarding',
        variant: VoltxSnackbarVariant.error,
      );
      return;
    }
    await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
  }
}
