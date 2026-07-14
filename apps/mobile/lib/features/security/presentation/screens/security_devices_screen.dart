import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../shared/widgets/async_value_view.dart';
import '../../../../shared/widgets/empty_state.dart';
import '../../../../shared/widgets/pull_to_refresh.dart';
import '../../../../theme/components/voltx_card.dart';
import '../../../../theme/components/voltx_snackbar.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';
import '../../data/models/security_models.dart';
import '../providers/security_providers.dart';
import '../shell/security_nav_bar.dart';

class SecurityDevicesScreen extends ConsumerWidget {
  const SecurityDevicesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final devices = ref.watch(trustedDevicesProvider);
    final actionState = ref.watch(securityActionControllerProvider);

    return Column(
      children: [
        const SecurityNavBar(),
        Expanded(
          child: PullToRefresh(
            onRefresh: () async => ref.invalidate(trustedDevicesProvider),
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(AppSpacing.md),
              children: [
                Text(
                  'Trusted devices',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  'Devices you chose to remember at login — MFA is skipped on these until trust expires.',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: AppSpacing.md),
                AsyncValueView<List<TrustedDevice>>(
                  value: devices,
                  onRetry: () => ref.invalidate(trustedDevicesProvider),
                  isEmpty: (result) => result.isEmpty,
                  empty: (context) => const EmptyState(
                    icon: Icons.smartphone_outlined,
                    title: 'No trusted devices',
                    message: "You haven't marked any device as trusted yet.",
                  ),
                  data: (context, result) => Column(
                    children: [
                      for (final device in result)
                        Padding(
                          padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                          child: _DeviceTile(device: device, isLoading: actionState.isLoading),
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

class _DeviceTile extends ConsumerWidget {
  const _DeviceTile({required this.device, required this.isLoading});

  final TrustedDevice device;
  final bool isLoading;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.voltxColors;
    return VoltxCard(
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  device.label ?? 'Unnamed device',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w600),
                ),
                Text(
                  'Trusted until ${device.trustedUntil.split('T').first}',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.textSecondary),
                ),
              ],
            ),
          ),
          OutlinedButton(
            onPressed: isLoading ? null : () => _revoke(context, ref),
            child: const Text('Revoke'),
          ),
        ],
      ),
    );
  }

  Future<void> _revoke(BuildContext context, WidgetRef ref) async {
    final success =
        await ref.read(securityActionControllerProvider.notifier).revokeTrustedDevice(device.id);
    if (!context.mounted) return;
    if (success) {
      showVoltxSnackbar(
        context,
        message: 'Trust revoked — this device will be MFA-challenged again',
        variant: VoltxSnackbarVariant.success,
      );
    } else {
      showVoltxSnackbar(
        context,
        message: ref.read(securityActionControllerProvider).errorMessage ?? 'Unable to revoke trust',
        variant: VoltxSnackbarVariant.error,
      );
    }
  }
}
