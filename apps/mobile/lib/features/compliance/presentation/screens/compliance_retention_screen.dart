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

const Map<String, String> _resourceLabels = {
  'AUDIT_LOG': 'Audit log',
  'CONVERSATION': 'Conversation',
  'NOTIFICATION': 'Notification',
  'ATTACHMENT': 'Attachment',
};

class ComplianceRetentionScreen extends ConsumerWidget {
  const ComplianceRetentionScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final policies = ref.watch(retentionPoliciesProvider);
    final actionState = ref.watch(complianceActionControllerProvider);

    return Column(
      children: [
        const ComplianceNavBar(),
        Expanded(
          child: PullToRefresh(
            onRefresh: () async => ref.invalidate(retentionPoliciesProvider),
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
                            'Retention policies',
                            style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
                          ),
                          Text(
                            'One policy per resource type. Controls automatic cleanup.',
                            style: Theme.of(context).textTheme.bodyMedium,
                          ),
                        ],
                      ),
                    ),
                    FilledButton.icon(
                      onPressed: actionState.isLoading ? null : () => _showCreateDialog(context, ref),
                      icon: const Icon(Icons.add_rounded, size: 18),
                      label: const Text('Add'),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),
                AsyncValueView<List<RetentionPolicy>>(
                  value: policies,
                  onRetry: () => ref.invalidate(retentionPoliciesProvider),
                  isEmpty: (result) => result.isEmpty,
                  empty: (context) => const EmptyState(
                    icon: Icons.auto_delete_outlined,
                    title: 'No retention policies',
                    message: 'Add a policy to automatically clean up data on a schedule.',
                  ),
                  data: (context, result) => Column(
                    children: [
                      for (final policy in result)
                        Padding(
                          padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                          child: _PolicyTile(policy: policy, isLoading: actionState.isLoading),
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
    showDialog<void>(context: context, builder: (context) => const _CreatePolicyDialog());
  }
}

class _PolicyTile extends ConsumerWidget {
  const _PolicyTile({required this.policy, required this.isLoading});

  final RetentionPolicy policy;
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
                  _resourceLabels[policy.resourceType] ?? policy.resourceType,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
                ),
                Text(
                  '${policy.retentionDays} days · ${policy.action}',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.textSecondary),
                ),
              ],
            ),
          ),
          Switch(
            value: policy.isActive,
            onChanged: isLoading
                ? null
                : (value) async {
                    final success = await ref
                        .read(complianceActionControllerProvider.notifier)
                        .updateRetentionPolicy(policy.id, isActive: value);
                    if (!context.mounted) return;
                    if (success) {
                      showVoltxSnackbar(
                        context,
                        message: value ? 'Policy enabled' : 'Policy disabled',
                        variant: VoltxSnackbarVariant.success,
                      );
                    }
                  },
          ),
          IconButton(
            icon: Icon(Icons.delete_outline_rounded, color: colors.error),
            onPressed: isLoading ? null : () => _confirmDelete(context, ref),
          ),
        ],
      ),
    );
  }

  Future<void> _confirmDelete(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text('Delete policy for "${_resourceLabels[policy.resourceType] ?? policy.resourceType}"?'),
        content: const Text('That resource type will no longer be automatically cleaned up.'),
        actions: [
          TextButton(onPressed: () => Navigator.of(context).pop(false), child: const Text('Cancel')),
          FilledButton(onPressed: () => Navigator.of(context).pop(true), child: const Text('Delete')),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;
    final success = await ref.read(complianceActionControllerProvider.notifier).deleteRetentionPolicy(policy.id);
    if (!context.mounted) return;
    if (success) {
      showVoltxSnackbar(context, message: 'Retention policy deleted', variant: VoltxSnackbarVariant.success);
    } else {
      showVoltxSnackbar(
        context,
        message: ref.read(complianceActionControllerProvider).errorMessage ?? 'Unable to delete policy',
        variant: VoltxSnackbarVariant.error,
      );
    }
  }
}

class _CreatePolicyDialog extends ConsumerStatefulWidget {
  const _CreatePolicyDialog();

  @override
  ConsumerState<_CreatePolicyDialog> createState() => _CreatePolicyDialogState();
}

class _CreatePolicyDialogState extends ConsumerState<_CreatePolicyDialog> {
  String _resourceType = retentionResourceTypes.first;
  final _retentionDaysController = TextEditingController(text: '90');
  String _action = 'DELETE';
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _retentionDaysController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Add a retention policy'),
      content: SizedBox(
        width: 360,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            DropdownButtonFormField<String>(
              initialValue: _resourceType,
              decoration: const InputDecoration(labelText: 'Resource type'),
              items: [
                for (final key in retentionResourceTypes)
                  DropdownMenuItem(value: key, child: Text(_resourceLabels[key] ?? key)),
              ],
              onChanged: (value) => setState(() => _resourceType = value ?? _resourceType),
            ),
            const SizedBox(height: AppSpacing.sm),
            TextField(
              controller: _retentionDaysController,
              decoration: const InputDecoration(labelText: 'Retention (days)'),
              keyboardType: TextInputType.number,
            ),
            const SizedBox(height: AppSpacing.sm),
            DropdownButtonFormField<String>(
              initialValue: _action,
              decoration: const InputDecoration(labelText: 'Action on expiry'),
              items: const [
                DropdownMenuItem(value: 'DELETE', child: Text('Delete')),
                DropdownMenuItem(value: 'ANONYMIZE', child: Text('Anonymize')),
              ],
              onChanged: (value) => setState(() => _action = value ?? _action),
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
              : const Text('Add policy'),
        ),
      ],
    );
  }

  Future<void> _submit() async {
    final days = int.tryParse(_retentionDaysController.text.trim());
    if (days == null || days < 1) {
      setState(() => _error = 'Enter a retention period of at least 1 day');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    final success = await ref.read(complianceActionControllerProvider.notifier).createRetentionPolicy(
          resourceType: _resourceType,
          retentionDays: days,
          action: _action,
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
