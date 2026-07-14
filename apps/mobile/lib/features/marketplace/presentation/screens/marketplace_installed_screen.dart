import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../shared/widgets/async_value_view.dart';
import '../../../../shared/widgets/empty_state.dart';
import '../../../../shared/widgets/pull_to_refresh.dart';
import '../../../../theme/components/voltx_card.dart';
import '../../../../theme/components/voltx_snackbar.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';
import '../../data/models/marketplace_models.dart';
import '../providers/marketplace_providers.dart';
import '../shell/marketplace_nav_bar.dart';

class MarketplaceInstalledScreen extends ConsumerWidget {
  const MarketplaceInstalledScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final installed = ref.watch(installedAppsProvider);
    final actionState = ref.watch(marketplaceActionControllerProvider);

    return Column(
      children: [
        const MarketplaceNavBar(),
        Expanded(
          child: PullToRefresh(
            onRefresh: () async => ref.invalidate(installedAppsProvider),
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(AppSpacing.md),
              children: [
                Text(
                  'Installed apps',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: AppSpacing.md),
                AsyncValueView<List<MarketplaceInstall>>(
                  value: installed,
                  onRetry: () => ref.invalidate(installedAppsProvider),
                  isEmpty: (result) => result.isEmpty,
                  empty: (context) => const EmptyState(
                    icon: Icons.download_done_outlined,
                    title: 'No apps installed',
                    message: 'Browse the marketplace to install your first app.',
                  ),
                  data: (context, result) => Column(
                    children: [
                      for (final install in result.where((i) => i.status == 'ACTIVE'))
                        Padding(
                          padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                          child: _InstalledTile(install: install, isLoading: actionState.isLoading),
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

class _InstalledTile extends ConsumerWidget {
  const _InstalledTile({required this.install, required this.isLoading});

  final MarketplaceInstall install;
  final bool isLoading;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.voltxColors;
    final app = ref.watch(publishedAppDetailProvider(install.appId));
    return VoltxCard(
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  app.maybeWhen(data: (app) => app.name, orElse: () => 'Loading...'),
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
                ),
                Text(
                  'Installed ${install.createdAt.split('T').first}',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.textSecondary),
                ),
              ],
            ),
          ),
          OutlinedButton(
            onPressed: isLoading ? null : () => _uninstall(context, ref),
            child: const Text('Uninstall'),
          ),
        ],
      ),
    );
  }

  Future<void> _uninstall(BuildContext context, WidgetRef ref) async {
    final success = await ref.read(marketplaceActionControllerProvider.notifier).uninstall(install.id);
    if (!context.mounted) return;
    if (success) {
      showVoltxSnackbar(context, message: 'App uninstalled', variant: VoltxSnackbarVariant.success);
    } else {
      showVoltxSnackbar(
        context,
        message: ref.read(marketplaceActionControllerProvider).errorMessage ?? 'Unable to uninstall app',
        variant: VoltxSnackbarVariant.error,
      );
    }
  }
}
