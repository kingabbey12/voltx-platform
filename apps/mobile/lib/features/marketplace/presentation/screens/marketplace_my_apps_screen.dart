import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../router/routes.dart';
import '../../../../shared/widgets/async_value_view.dart';
import '../../../../shared/widgets/empty_state.dart';
import '../../../../shared/widgets/pull_to_refresh.dart';
import '../../../../theme/components/voltx_card.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';
import '../../data/models/marketplace_models.dart';
import '../providers/marketplace_providers.dart';
import '../shell/marketplace_nav_bar.dart';

class MarketplaceMyAppsScreen extends ConsumerWidget {
  const MarketplaceMyAppsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final apps = ref.watch(myAppsProvider);
    final actionState = ref.watch(marketplaceActionControllerProvider);

    return Column(
      children: [
        const MarketplaceNavBar(),
        Expanded(
          child: PullToRefresh(
            onRefresh: () async => ref.invalidate(myAppsProvider),
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(AppSpacing.md),
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        'My apps',
                        style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
                      ),
                    ),
                    FilledButton.icon(
                      onPressed: actionState.isLoading ? null : () => _showCreateDialog(context, ref),
                      icon: const Icon(Icons.add_rounded, size: 18),
                      label: const Text('New app'),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),
                AsyncValueView<List<MarketplaceApp>>(
                  value: apps,
                  onRetry: () => ref.invalidate(myAppsProvider),
                  isEmpty: (result) => result.isEmpty,
                  empty: (context) => const EmptyState(
                    icon: Icons.apps_outlined,
                    title: 'No apps published yet',
                    message: 'Create an app to start publishing to the Voltx Marketplace.',
                  ),
                  data: (context, result) => Column(
                    children: [
                      for (final app in result)
                        Padding(
                          padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                          child: _MyAppTile(app: app),
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

  void _showCreateDialog(BuildContext context, WidgetRef ref) {
    showDialog<void>(context: context, builder: (context) => const _CreateAppDialog());
  }
}

class _MyAppTile extends StatelessWidget {
  const _MyAppTile({required this.app});

  final MarketplaceApp app;

  @override
  Widget build(BuildContext context) {
    final colors = context.voltxColors;
    final (statusColor, statusSurface) = switch (app.status) {
      'PUBLISHED' => (colors.success, colors.successSurface),
      'PENDING_REVIEW' => (colors.warning, colors.warningSurface),
      'SUSPENDED' => (colors.error, colors.errorSurface),
      _ => (colors.textSecondary, colors.surfaceMuted),
    };

    return VoltxCard(
      onTap: () => context.go(AppRoutes.marketplaceMyAppDetails(app.id)),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(app.name, style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700)),
                Text(app.category, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.textSecondary)),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs, vertical: 2),
            decoration: BoxDecoration(color: statusSurface, borderRadius: BorderRadius.circular(999)),
            child: Text(
              app.status,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(color: statusColor, fontWeight: FontWeight.w700),
            ),
          ),
          const SizedBox(width: AppSpacing.xs),
          const Icon(Icons.chevron_right_rounded),
        ],
      ),
    );
  }
}

class _CreateAppDialog extends ConsumerStatefulWidget {
  const _CreateAppDialog();

  @override
  ConsumerState<_CreateAppDialog> createState() => _CreateAppDialogState();
}

class _CreateAppDialogState extends ConsumerState<_CreateAppDialog> {
  final _nameController = TextEditingController();
  final _descriptionController = TextEditingController();
  String _category = marketplaceAppCategories.first;
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _nameController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Create an app'),
      content: SizedBox(
        width: 360,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TextField(controller: _nameController, decoration: const InputDecoration(labelText: 'Name')),
            const SizedBox(height: AppSpacing.sm),
            DropdownButtonFormField<String>(
              initialValue: _category,
              decoration: const InputDecoration(labelText: 'Category'),
              items: [
                for (final key in marketplaceAppCategories) DropdownMenuItem(value: key, child: Text(key)),
              ],
              onChanged: (value) => setState(() => _category = value ?? _category),
            ),
            const SizedBox(height: AppSpacing.sm),
            TextField(
              controller: _descriptionController,
              decoration: const InputDecoration(labelText: 'Description (optional)'),
              maxLines: 3,
            ),
            if (_error != null) ...[
              const SizedBox(height: AppSpacing.sm),
              Text(_error!, style: TextStyle(color: context.voltxColors.error)),
            ],
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: _submitting ? null : () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        FilledButton(
          onPressed: _submitting ? null : _submit,
          child: _submitting
              ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
              : const Text('Create'),
        ),
      ],
    );
  }

  Future<void> _submit() async {
    if (_nameController.text.trim().isEmpty) {
      setState(() => _error = 'Name is required');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    final result = await ref.read(marketplaceActionControllerProvider.notifier).createApp(
          name: _nameController.text.trim(),
          category: _category,
          description: _descriptionController.text.trim().isEmpty ? null : _descriptionController.text.trim(),
        );
    if (!mounted) return;
    if (result != null) {
      Navigator.of(context).pop();
    } else {
      setState(() {
        _submitting = false;
        _error = ref.read(marketplaceActionControllerProvider).errorMessage;
      });
    }
  }
}
