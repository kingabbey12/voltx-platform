import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../shared/widgets/async_value_view.dart';
import '../../../../shared/widgets/empty_state.dart';
import '../../../../shared/widgets/pull_to_refresh.dart';
import '../../../../theme/components/voltx_card.dart';
import '../../../../theme/components/voltx_snackbar.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';
import '../../data/models/compliance_models.dart';
import '../providers/compliance_providers.dart';
import '../shell/compliance_nav_bar.dart';

class ComplianceLegalHoldsScreen extends ConsumerWidget {
  const ComplianceLegalHoldsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final holds = ref.watch(legalHoldsProvider);
    final actionState = ref.watch(complianceActionControllerProvider);

    return Column(
      children: [
        const ComplianceNavBar(),
        Expanded(
          child: PullToRefresh(
            onRefresh: () async => ref.invalidate(legalHoldsProvider),
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
                            'Legal holds',
                            style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
                          ),
                          Text(
                            'Preserve data from deletion for legal or investigative purposes.',
                            style: Theme.of(context).textTheme.bodyMedium,
                          ),
                        ],
                      ),
                    ),
                    FilledButton.icon(
                      onPressed: actionState.isLoading ? null : () => _showCreateDialog(context, ref),
                      icon: const Icon(Icons.add_rounded, size: 18),
                      label: const Text('Place hold'),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),
                AsyncValueView<List<LegalHold>>(
                  value: holds,
                  onRetry: () => ref.invalidate(legalHoldsProvider),
                  isEmpty: (result) => result.isEmpty,
                  empty: (context) => const EmptyState(
                    icon: Icons.gavel_outlined,
                    title: 'No legal holds',
                    message: "Place a hold to prevent a user's data from being deleted.",
                  ),
                  data: (context, result) => Column(
                    children: [
                      for (final hold in result)
                        Padding(
                          padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                          child: _HoldTile(hold: hold, isLoading: actionState.isLoading),
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
    showDialog<void>(context: context, builder: (context) => const _CreateHoldDialog());
  }
}

class _HoldTile extends ConsumerWidget {
  const _HoldTile({required this.hold, required this.isLoading});

  final LegalHold hold;
  final bool isLoading;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.voltxColors;
    final active = hold.status == 'ACTIVE';
    return VoltxCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(hold.name, style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700)),
                    Text(
                      hold.reason,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.textSecondary),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs, vertical: 2),
                decoration: BoxDecoration(
                  color: active ? colors.warningSurface : colors.surfaceMuted,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  active ? 'Active' : 'Released',
                  style: TextStyle(color: active ? colors.warning : colors.textSecondary, fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xxs),
          Text(
            hold.targetUserId ?? 'Organization-wide',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.textSecondary),
          ),
          if (active) ...[
            const SizedBox(height: AppSpacing.xs),
            Align(
              alignment: Alignment.centerRight,
              child: OutlinedButton(
                onPressed: isLoading ? null : () => _release(context, ref),
                child: const Text('Release'),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Future<void> _release(BuildContext context, WidgetRef ref) async {
    final success = await ref.read(complianceActionControllerProvider.notifier).releaseLegalHold(hold.id);
    if (!context.mounted) return;
    if (success) {
      showVoltxSnackbar(context, message: 'Released "${hold.name}"', variant: VoltxSnackbarVariant.success);
    } else {
      showVoltxSnackbar(
        context,
        message: ref.read(complianceActionControllerProvider).errorMessage ?? 'Unable to release hold',
        variant: VoltxSnackbarVariant.error,
      );
    }
  }
}

class _CreateHoldDialog extends ConsumerStatefulWidget {
  const _CreateHoldDialog();

  @override
  ConsumerState<_CreateHoldDialog> createState() => _CreateHoldDialogState();
}

class _CreateHoldDialogState extends ConsumerState<_CreateHoldDialog> {
  final _nameController = TextEditingController();
  final _reasonController = TextEditingController();
  final _targetUserIdController = TextEditingController();
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _nameController.dispose();
    _reasonController.dispose();
    _targetUserIdController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Place a legal hold'),
      content: SizedBox(
        width: 360,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TextField(controller: _nameController, decoration: const InputDecoration(labelText: 'Name')),
            const SizedBox(height: AppSpacing.sm),
            TextField(
              controller: _reasonController,
              decoration: const InputDecoration(labelText: 'Reason'),
              maxLines: 2,
            ),
            const SizedBox(height: AppSpacing.sm),
            TextField(
              controller: _targetUserIdController,
              decoration: const InputDecoration(
                labelText: 'Target user ID (optional)',
                hintText: 'Leave empty for organization-wide',
              ),
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
              : const Text('Place hold'),
        ),
      ],
    );
  }

  Future<void> _submit() async {
    if (_nameController.text.trim().isEmpty || _reasonController.text.trim().isEmpty) {
      setState(() => _error = 'Name and reason are required');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    final success = await ref.read(complianceActionControllerProvider.notifier).createLegalHold(
          name: _nameController.text.trim(),
          reason: _reasonController.text.trim(),
          targetUserId: _targetUserIdController.text.trim().isEmpty ? null : _targetUserIdController.text.trim(),
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
