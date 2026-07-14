import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../../shared/widgets/async_value_view.dart';
import '../../../../theme/components/voltx_card.dart';
import '../../../../theme/components/voltx_snackbar.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';
import '../providers/compliance_providers.dart';
import '../shell/compliance_nav_bar.dart';

class ComplianceGdprScreen extends ConsumerStatefulWidget {
  const ComplianceGdprScreen({super.key});

  @override
  ConsumerState<ComplianceGdprScreen> createState() => _ComplianceGdprScreenState();
}

class _ComplianceGdprScreenState extends ConsumerState<ComplianceGdprScreen> {
  final _exportUserIdController = TextEditingController();
  final _deleteUserIdController = TextEditingController();

  @override
  void dispose() {
    _exportUserIdController.dispose();
    _deleteUserIdController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final actionState = ref.watch(complianceActionControllerProvider);
    final colors = context.voltxColors;

    return Column(
      children: [
        const ComplianceNavBar(),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(AppSpacing.md),
            children: [
              VoltxCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Data export (Right to Access)', style: Theme.of(context).textTheme.titleSmall),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      'Generate a downloadable export of everything Voltx holds about a given user.',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    TextField(
                      controller: _exportUserIdController,
                      decoration: const InputDecoration(labelText: 'User ID'),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    FilledButton.icon(
                      onPressed: actionState.isLoading ? null : _export,
                      icon: const Icon(Icons.download_rounded, size: 18),
                      label: const Text('Export'),
                    ),
                    if (actionState.lastExport != null) ...[
                      const SizedBox(height: AppSpacing.sm),
                      Container(
                        padding: const EdgeInsets.all(AppSpacing.sm),
                        decoration: BoxDecoration(color: colors.surfaceMuted, borderRadius: BorderRadius.circular(12)),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text('Expires ${actionState.lastExport!.expiresAt.split('T').first}',
                                style: Theme.of(context).textTheme.bodySmall),
                            const SizedBox(height: AppSpacing.xxs),
                            Wrap(
                              spacing: AppSpacing.xxs,
                              runSpacing: AppSpacing.xxs,
                              children: [
                                for (final section in actionState.lastExport!.sections)
                                  Chip(label: Text('${section.label}: ${section.rowCount}')),
                              ],
                            ),
                            const SizedBox(height: AppSpacing.xs),
                            OutlinedButton.icon(
                              onPressed: () => launchUrl(
                                Uri.parse(actionState.lastExport!.downloadUrl),
                                mode: LaunchMode.externalApplication,
                              ),
                              icon: const Icon(Icons.open_in_new_rounded, size: 16),
                              label: const Text('Download'),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              VoltxCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Data erasure (Right to be Forgotten)', style: Theme.of(context).textTheme.titleSmall),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      'Permanently deletes or anonymizes a user\'s data. Blocked by an active legal hold. Cannot be undone.',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    TextField(
                      controller: _deleteUserIdController,
                      decoration: const InputDecoration(labelText: 'User ID'),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    if (actionState.errorMessage != null) ...[
                      InlineErrorCard(message: actionState.errorMessage!),
                      const SizedBox(height: AppSpacing.sm),
                    ],
                    OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(foregroundColor: colors.error),
                      onPressed: actionState.isLoading ? null : _confirmDelete,
                      icon: const Icon(Icons.delete_forever_outlined, size: 18),
                      label: const Text('Erase data'),
                    ),
                    if (actionState.lastDeletion != null) ...[
                      const SizedBox(height: AppSpacing.sm),
                      Container(
                        padding: const EdgeInsets.all(AppSpacing.sm),
                        decoration: BoxDecoration(color: colors.surfaceMuted, borderRadius: BorderRadius.circular(12)),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Identity scrubbed: ${actionState.lastDeletion!.globalIdentityScrubbed ? "Yes" : "No"}',
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                            const SizedBox(height: AppSpacing.xs),
                            for (final outcome in actionState.lastDeletion!.results)
                              Padding(
                                padding: const EdgeInsets.only(bottom: AppSpacing.xxs),
                                child: Row(
                                  children: [
                                    Expanded(child: Text(outcome.label, style: Theme.of(context).textTheme.bodySmall)),
                                    Text(
                                      '${outcome.action} (${outcome.affected})',
                                      style: Theme.of(context).textTheme.labelSmall?.copyWith(fontWeight: FontWeight.w700),
                                    ),
                                  ],
                                ),
                              ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Future<void> _export() async {
    if (_exportUserIdController.text.trim().isEmpty) return;
    final success =
        await ref.read(complianceActionControllerProvider.notifier).exportUserData(_exportUserIdController.text.trim());
    if (!mounted) return;
    if (success) {
      showVoltxSnackbar(context, message: 'Export ready', variant: VoltxSnackbarVariant.success);
    } else {
      showVoltxSnackbar(
        context,
        message: ref.read(complianceActionControllerProvider).errorMessage ?? 'Unable to export data',
        variant: VoltxSnackbarVariant.error,
      );
    }
  }

  Future<void> _confirmDelete() async {
    if (_deleteUserIdController.text.trim().isEmpty) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Confirm permanent erasure'),
        content: const Text(
          'This will delete or anonymize every record Voltx holds for this user, except data under legal '
          'hold or independent retention requirements. This cannot be undone.',
        ),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('Erase permanently')),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    final success =
        await ref.read(complianceActionControllerProvider.notifier).deleteUserData(_deleteUserIdController.text.trim());
    if (!mounted) return;
    if (success) {
      showVoltxSnackbar(context, message: 'Erasure request processed', variant: VoltxSnackbarVariant.success);
    } else {
      showVoltxSnackbar(
        context,
        message: ref.read(complianceActionControllerProvider).errorMessage ?? 'Unable to erase data',
        variant: VoltxSnackbarVariant.error,
      );
    }
  }
}
