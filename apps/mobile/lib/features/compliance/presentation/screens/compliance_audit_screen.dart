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

const List<String> _auditExportFormats = ['JSON', 'CSV'];

class ComplianceAuditScreen extends ConsumerStatefulWidget {
  const ComplianceAuditScreen({super.key});

  @override
  ConsumerState<ComplianceAuditScreen> createState() => _ComplianceAuditScreenState();
}

class _ComplianceAuditScreenState extends ConsumerState<ComplianceAuditScreen> {
  DateTime? _fromDate;
  DateTime? _toDate;
  String _format = _auditExportFormats.first;

  @override
  Widget build(BuildContext context) {
    final actionState = ref.watch(complianceActionControllerProvider);
    final exportId = ref.watch(auditExportIdProvider);
    final exportStatus = exportId == null ? null : ref.watch(auditExportStatusProvider(exportId));
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
                    Text('Export audit log', style: Theme.of(context).textTheme.titleSmall),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      'Generate a downloadable export of every audit event in a date range.',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () => _pickDate(isFrom: true),
                            child: Text(_fromDate == null ? 'From date' : _fromDate!.toIso8601String().split('T').first),
                          ),
                        ),
                        const SizedBox(width: AppSpacing.xs),
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () => _pickDate(isFrom: false),
                            child: Text(_toDate == null ? 'To date' : _toDate!.toIso8601String().split('T').first),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    DropdownButtonFormField<String>(
                      initialValue: _format,
                      decoration: const InputDecoration(labelText: 'Format'),
                      items: [
                        for (final format in _auditExportFormats) DropdownMenuItem(value: format, child: Text(format)),
                      ],
                      onChanged: (value) => setState(() => _format = value ?? _format),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    FilledButton(
                      onPressed: actionState.isLoading ? null : _requestExport,
                      child: const Text('Request export'),
                    ),
                    if (exportStatus != null) ...[
                      const SizedBox(height: AppSpacing.sm),
                      exportStatus.when(
                        data: (result) {
                          final (color, surface) = switch (result.status) {
                            'COMPLETED' => (colors.success, colors.successSurface),
                            'FAILED' => (colors.error, colors.errorSurface),
                            _ => (colors.warning, colors.warningSurface),
                          };
                          return Container(
                            padding: const EdgeInsets.all(AppSpacing.sm),
                            decoration: BoxDecoration(color: colors.surfaceMuted, borderRadius: BorderRadius.circular(12)),
                            child: Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs, vertical: 2),
                                  decoration: BoxDecoration(color: surface, borderRadius: BorderRadius.circular(999)),
                                  child: Text(result.status, style: TextStyle(color: color, fontWeight: FontWeight.w700)),
                                ),
                                const SizedBox(width: AppSpacing.xs),
                                Expanded(
                                  child: Text(
                                    result.rowCount != null ? '${result.rowCount} rows' : result.errorMessage ?? '',
                                    style: Theme.of(context).textTheme.bodySmall,
                                  ),
                                ),
                                if (result.downloadUrl != null)
                                  IconButton(
                                    icon: const Icon(Icons.download_rounded),
                                    onPressed: () =>
                                        launchUrl(Uri.parse(result.downloadUrl!), mode: LaunchMode.externalApplication),
                                  ),
                              ],
                            ),
                          );
                        },
                        loading: () => const Padding(
                          padding: EdgeInsets.symmetric(vertical: AppSpacing.sm),
                          child: Center(child: CircularProgressIndicator()),
                        ),
                        error: (error, _) => InlineErrorCard(message: AsyncValueView.friendlyMessageFor(error)),
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
                    Text('Verify audit chain integrity', style: Theme.of(context).textTheme.titleSmall),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      'Audit log entries are hash-chained — verify none have been tampered with or removed.',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    OutlinedButton.icon(
                      onPressed: actionState.isLoading ? null : () => ref.read(complianceActionControllerProvider.notifier).verifyAuditChain(),
                      icon: const Icon(Icons.verified_outlined, size: 18),
                      label: const Text('Run verification'),
                    ),
                    if (actionState.lastVerify != null) ...[
                      const SizedBox(height: AppSpacing.sm),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(
                            actionState.lastVerify!.valid ? Icons.check_circle_rounded : Icons.cancel_rounded,
                            color: actionState.lastVerify!.valid ? colors.success : colors.error,
                          ),
                          const SizedBox(width: AppSpacing.xs),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  actionState.lastVerify!.valid ? 'Chain intact' : 'Chain integrity broken',
                                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
                                ),
                                Text('${actionState.lastVerify!.checked} entries checked.', style: Theme.of(context).textTheme.bodySmall),
                                if (!actionState.lastVerify!.valid)
                                  Text(
                                    'Broken at index ${actionState.lastVerify!.brokenAtIndex} (log entry ${actionState.lastVerify!.brokenAuditLogId})',
                                    style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.error),
                                  ),
                              ],
                            ),
                          ),
                        ],
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

  Future<void> _pickDate({required bool isFrom}) async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: now,
      firstDate: DateTime(now.year - 5),
      lastDate: now,
    );
    if (picked == null) return;
    setState(() {
      if (isFrom) {
        _fromDate = picked;
      } else {
        _toDate = picked;
      }
    });
  }

  Future<void> _requestExport() async {
    if (_fromDate == null || _toDate == null) {
      showVoltxSnackbar(context, message: 'Choose both a from and to date', variant: VoltxSnackbarVariant.warning);
      return;
    }
    final id = await ref.read(complianceActionControllerProvider.notifier).createAuditExport(
          fromDate: _fromDate!.toIso8601String(),
          toDate: _toDate!.toIso8601String(),
          format: _format,
        );
    if (!mounted) return;
    if (id != null) {
      ref.read(auditExportIdProvider.notifier).state = id;
      showVoltxSnackbar(context, message: 'Export requested', variant: VoltxSnackbarVariant.success);
    } else {
      showVoltxSnackbar(
        context,
        message: ref.read(complianceActionControllerProvider).errorMessage ?? 'Unable to request export',
        variant: VoltxSnackbarVariant.error,
      );
    }
  }
}
