import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../shared/widgets/async_value_view.dart';
import '../../../../shared/widgets/empty_state.dart';
import '../../../../shared/widgets/pull_to_refresh.dart';
import '../../../../theme/components/voltx_card.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';
import '../../data/models/compliance_models.dart';
import '../providers/compliance_providers.dart';
import '../shell/compliance_nav_bar.dart';

class ComplianceConsentScreen extends ConsumerWidget {
  const ComplianceConsentScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final records = ref.watch(consentRecordsProvider);
    final actionState = ref.watch(complianceActionControllerProvider);

    return Column(
      children: [
        const ComplianceNavBar(),
        Expanded(
          child: PullToRefresh(
            onRefresh: () async => ref.invalidate(consentRecordsProvider),
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(AppSpacing.md),
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Consent records',
                            style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
                          ),
                          Text(
                            'Append-only history of user consent decisions.',
                            style: Theme.of(context).textTheme.bodyMedium,
                          ),
                        ],
                      ),
                    ),
                    FilledButton.icon(
                      onPressed: actionState.isLoading ? null : () => _showLogDialog(context, ref),
                      icon: const Icon(Icons.add_rounded, size: 18),
                      label: const Text('Log'),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),
                AsyncValueView<List<ConsentRecord>>(
                  value: records,
                  onRetry: () => ref.invalidate(consentRecordsProvider),
                  isEmpty: (result) => result.isEmpty,
                  empty: (context) => const EmptyState(
                    icon: Icons.fact_check_outlined,
                    title: 'No consent records yet',
                    message: 'Log the first consent decision for a user.',
                  ),
                  data: (context, result) => Column(
                    children: [
                      for (final record in result)
                        Padding(
                          padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                          child: _ConsentTile(record: record),
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

  void _showLogDialog(BuildContext context, WidgetRef ref) {
    showDialog<void>(context: context, builder: (context) => const _LogConsentDialog());
  }
}

class _ConsentTile extends StatelessWidget {
  const _ConsentTile({required this.record});

  final ConsentRecord record;

  @override
  Widget build(BuildContext context) {
    final colors = context.voltxColors;
    final (color, surface) =
        record.granted ? (colors.success, colors.successSurface) : (colors.error, colors.errorSurface);
    return VoltxCard(
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(record.consentType, style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700)),
                Text(
                  record.userId,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.textSecondary),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs, vertical: 2),
            decoration: BoxDecoration(color: surface, borderRadius: BorderRadius.circular(999)),
            child: Text(
              record.granted ? 'Granted' : 'Revoked',
              style: TextStyle(color: color, fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }
}

class _LogConsentDialog extends ConsumerStatefulWidget {
  const _LogConsentDialog();

  @override
  ConsumerState<_LogConsentDialog> createState() => _LogConsentDialogState();
}

class _LogConsentDialogState extends ConsumerState<_LogConsentDialog> {
  final _userIdController = TextEditingController();
  final _consentTypeController = TextEditingController();
  bool _granted = true;
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _userIdController.dispose();
    _consentTypeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Log a consent record'),
      content: SizedBox(
        width: 360,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TextField(controller: _userIdController, decoration: const InputDecoration(labelText: 'User ID')),
            const SizedBox(height: AppSpacing.sm),
            TextField(
              controller: _consentTypeController,
              decoration: const InputDecoration(labelText: 'Consent type', hintText: 'e.g. marketing_emails'),
            ),
            SwitchListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Consent granted'),
              value: _granted,
              onChanged: (value) => setState(() => _granted = value),
            ),
            if (_error != null) Text(_error!, style: TextStyle(color: context.voltxColors.error)),
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
              : const Text('Log record'),
        ),
      ],
    );
  }

  Future<void> _submit() async {
    if (_userIdController.text.trim().isEmpty || _consentTypeController.text.trim().isEmpty) {
      setState(() => _error = 'User ID and consent type are required');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    final success = await ref.read(complianceActionControllerProvider.notifier).createConsentRecord(
          userId: _userIdController.text.trim(),
          consentType: _consentTypeController.text.trim(),
          granted: _granted,
        );
    if (!mounted) return;
    if (success) {
      Navigator.of(context).pop();
    } else {
      setState(() {
        _submitting = false;
        _error = ref.read(complianceActionControllerProvider).errorMessage;
      });
    }
  }
}
