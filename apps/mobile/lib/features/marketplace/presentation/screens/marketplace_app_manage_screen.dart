import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../shared/widgets/async_value_view.dart';
import '../../../../shared/widgets/empty_state.dart';
import '../../../../theme/components/voltx_card.dart';
import '../../../../theme/components/voltx_snackbar.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';
import '../../data/models/marketplace_models.dart';
import '../providers/marketplace_providers.dart';

class MarketplaceAppManageScreen extends ConsumerWidget {
  const MarketplaceAppManageScreen({required this.appId, super.key});

  final String appId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final versions = ref.watch(myAppVersionsProvider(appId));
    final aiTools = ref.watch(myAppAiToolsProvider(appId));
    final actionState = ref.watch(marketplaceActionControllerProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Manage app'),
        actions: [
          IconButton(
            onPressed: actionState.isLoading ? null : () => _showCreateVersionDialog(context, ref),
            icon: const Icon(Icons.add_rounded),
            tooltip: 'Submit version',
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(AppSpacing.md),
        children: [
          Text('Versions', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: AppSpacing.sm),
          AsyncValueView<List<MarketplaceAppVersion>>(
            value: versions,
            onRetry: () => ref.invalidate(myAppVersionsProvider(appId)),
            isEmpty: (result) => result.isEmpty,
            empty: (context) => const EmptyState(
              icon: Icons.new_releases_outlined,
              title: 'No versions yet',
              message: 'Submit your first version to start the review process.',
            ),
            data: (context, result) => Column(
              children: [
                for (final version in result)
                  Padding(
                    padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                    child: _VersionTile(version: version),
                  ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          Text('AI tool secrets', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'Signing secrets your extension uses to verify Voltx AI tool-call requests.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
          const SizedBox(height: AppSpacing.sm),
          AsyncValueView<List<ExtensionAiTool>>(
            value: aiTools,
            onRetry: () => ref.invalidate(myAppAiToolsProvider(appId)),
            isEmpty: (result) => result.isEmpty,
            empty: (context) => const EmptyState(
              icon: Icons.extension_outlined,
              title: 'No AI tools registered',
              message: 'Declare tools in your manifest to expose them here.',
            ),
            data: (context, result) => Column(
              children: [
                for (final tool in result)
                  Padding(
                    padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                    child: VoltxCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(tool.name, style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700)),
                          Text(tool.description, style: Theme.of(context).textTheme.bodySmall),
                          const SizedBox(height: AppSpacing.xxs),
                          Row(
                            children: [
                              Expanded(
                                child: Text(
                                  tool.signingSecret,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: Theme.of(context).textTheme.bodySmall?.copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
                                ),
                              ),
                              IconButton(
                                icon: const Icon(Icons.copy_rounded, size: 16),
                                onPressed: () {
                                  Clipboard.setData(ClipboardData(text: tool.signingSecret));
                                  showVoltxSnackbar(context, message: 'Copied to clipboard');
                                },
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _showCreateVersionDialog(BuildContext context, WidgetRef ref) {
    showDialog<void>(context: context, builder: (context) => _CreateVersionDialog(appId: appId));
  }
}

class _VersionTile extends StatelessWidget {
  const _VersionTile({required this.version});

  final MarketplaceAppVersion version;

  @override
  Widget build(BuildContext context) {
    final colors = context.voltxColors;
    final (statusColor, statusSurface) = switch (version.status) {
      'PUBLISHED' => (colors.success, colors.successSurface),
      'PENDING_REVIEW' => (colors.warning, colors.warningSurface),
      'REJECTED' => (colors.error, colors.errorSurface),
      _ => (colors.textSecondary, colors.surfaceMuted),
    };

    return VoltxCard(
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('v${version.version}', style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700)),
                if (version.changelog != null)
                  Text(
                    version.changelog!,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.textSecondary),
                  ),
                if (version.rejectionReason != null)
                  Text(
                    version.rejectionReason!,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.error),
                  ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs, vertical: 2),
            decoration: BoxDecoration(color: statusSurface, borderRadius: BorderRadius.circular(999)),
            child: Text(
              version.status,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(color: statusColor, fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }
}

class _CreateVersionDialog extends ConsumerStatefulWidget {
  const _CreateVersionDialog({required this.appId});

  final String appId;

  @override
  ConsumerState<_CreateVersionDialog> createState() => _CreateVersionDialogState();
}

class _CreateVersionDialogState extends ConsumerState<_CreateVersionDialog> {
  final _versionController = TextEditingController();
  final _changelogController = TextEditingController();
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _versionController.dispose();
    _changelogController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Submit a version'),
      content: SizedBox(
        width: 360,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TextField(
              controller: _versionController,
              decoration: const InputDecoration(labelText: 'Version', hintText: 'e.g. 1.0.0'),
            ),
            const SizedBox(height: AppSpacing.sm),
            TextField(
              controller: _changelogController,
              decoration: const InputDecoration(labelText: 'Changelog (optional)'),
              maxLines: 3,
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              'The manifest is submitted as an empty placeholder from mobile — finish configuring tools and '
              'permissions on the web app before publishing.',
              style: Theme.of(context).textTheme.bodySmall,
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
              : const Text('Submit'),
        ),
      ],
    );
  }

  Future<void> _submit() async {
    if (_versionController.text.trim().isEmpty) {
      setState(() => _error = 'Version is required');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    final result = await ref.read(marketplaceActionControllerProvider.notifier).createVersion(
          widget.appId,
          version: _versionController.text.trim(),
          manifest: const {},
          changelog: _changelogController.text.trim().isEmpty ? null : _changelogController.text.trim(),
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
