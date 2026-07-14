import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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

class SecurityApiKeysScreen extends ConsumerWidget {
  const SecurityApiKeysScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final keys = ref.watch(apiKeysProvider);
    final actionState = ref.watch(securityActionControllerProvider);

    return Column(
      children: [
        const SecurityNavBar(),
        Expanded(
          child: PullToRefresh(
            onRefresh: () async => ref.invalidate(apiKeysProvider),
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
                            'API keys',
                            style:
                                Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
                          ),
                          Text(
                            'Organization-wide keys for server-to-server integrations.',
                            style: Theme.of(context).textTheme.bodyMedium,
                          ),
                        ],
                      ),
                    ),
                    FilledButton.icon(
                      onPressed: actionState.isLoading ? null : () => _showCreateDialog(context, ref),
                      icon: const Icon(Icons.add_rounded, size: 18),
                      label: const Text('Create'),
                    ),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),
                AsyncValueView<List<ApiKey>>(
                  value: keys,
                  onRetry: () => ref.invalidate(apiKeysProvider),
                  isEmpty: (result) => result.isEmpty,
                  empty: (context) => const EmptyState(
                    icon: Icons.vpn_key_outlined,
                    title: 'No API keys yet',
                    message: 'Create one to authenticate server-to-server calls against the Voltx API.',
                  ),
                  data: (context, result) => Column(
                    children: [
                      for (final key in result)
                        Padding(
                          padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                          child: _ApiKeyTile(apiKey: key, isLoading: actionState.isLoading),
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
    showDialog<void>(context: context, builder: (context) => const _CreateApiKeyDialog());
  }
}

class _ApiKeyTile extends ConsumerWidget {
  const _ApiKeyTile({required this.apiKey, required this.isLoading});

  final ApiKey apiKey;
  final bool isLoading;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.voltxColors;
    return VoltxCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  apiKey.name,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
                ),
              ),
              if (apiKey.revokedAt != null)
                Text('Revoked', style: TextStyle(color: colors.error, fontWeight: FontWeight.w600))
              else
                OutlinedButton(
                  onPressed: isLoading ? null : () => _revoke(context, ref),
                  child: const Text('Revoke'),
                ),
            ],
          ),
          Text(apiKey.keyPrefix, style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.textSecondary)),
          const SizedBox(height: AppSpacing.xs),
          Wrap(
            spacing: AppSpacing.xxs,
            runSpacing: AppSpacing.xxs,
            children: [
              for (final permission in apiKey.scopedPermissions.take(3))
                _ScopeChip(label: permission),
              if (apiKey.scopedPermissions.length > 3)
                _ScopeChip(label: '+${apiKey.scopedPermissions.length - 3}'),
            ],
          ),
          const SizedBox(height: AppSpacing.xxs),
          Text(
            'Expires: ${apiKey.expiresAt?.split('T').first ?? 'Never'} · Last used: ${apiKey.lastUsedAt?.split('T').first ?? 'Never'}',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.textSecondary),
          ),
        ],
      ),
    );
  }

  Future<void> _revoke(BuildContext context, WidgetRef ref) async {
    final success = await ref.read(securityActionControllerProvider.notifier).revokeApiKey(apiKey.id);
    if (!context.mounted) return;
    if (success) {
      showVoltxSnackbar(context, message: 'Revoked "${apiKey.name}"', variant: VoltxSnackbarVariant.success);
    } else {
      showVoltxSnackbar(
        context,
        message: ref.read(securityActionControllerProvider).errorMessage ?? 'Unable to revoke key',
        variant: VoltxSnackbarVariant.error,
      );
    }
  }
}

class _ScopeChip extends StatelessWidget {
  const _ScopeChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final colors = context.voltxColors;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs, vertical: 2),
      decoration: BoxDecoration(color: colors.surfaceMuted, borderRadius: BorderRadius.circular(999)),
      child: Text(label, style: Theme.of(context).textTheme.labelSmall),
    );
  }
}

class _CreateApiKeyDialog extends ConsumerStatefulWidget {
  const _CreateApiKeyDialog();

  @override
  ConsumerState<_CreateApiKeyDialog> createState() => _CreateApiKeyDialogState();
}

class _CreateApiKeyDialogState extends ConsumerState<_CreateApiKeyDialog> {
  final _nameController = TextEditingController();
  final _permissionsController = TextEditingController();
  bool _submitting = false;
  String? _error;
  String? _createdKey;

  @override
  void dispose() {
    _nameController.dispose();
    _permissionsController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_createdKey != null) {
      return AlertDialog(
        title: const Text('Key created'),
        content: SizedBox(
          width: 360,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                "Copy it now — it's shown exactly once and can never be retrieved again.",
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: AppSpacing.sm),
              SelectableText(_createdKey!, style: Theme.of(context).textTheme.bodySmall),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () {
              Clipboard.setData(ClipboardData(text: _createdKey!));
              showVoltxSnackbar(context, message: 'Copied to clipboard');
            },
            child: const Text('Copy'),
          ),
          FilledButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Done')),
        ],
      );
    }

    return AlertDialog(
      title: const Text('Create an API key'),
      content: SizedBox(
        width: 360,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            TextField(
              controller: _nameController,
              decoration: const InputDecoration(labelText: 'Name'),
            ),
            const SizedBox(height: AppSpacing.sm),
            TextField(
              controller: _permissionsController,
              decoration: const InputDecoration(
                labelText: 'Permission keys',
                hintText: 'e.g. sales.opportunity.read sales.contact.read',
              ),
              maxLines: 2,
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
              : const Text('Create key'),
        ),
      ],
    );
  }

  Future<void> _submit() async {
    if (_nameController.text.trim().isEmpty) {
      setState(() => _error = 'Name is required');
      return;
    }
    final permissions = _permissionsController.text
        .split(RegExp(r'[\s,]+'))
        .map((key) => key.trim())
        .where((key) => key.isNotEmpty)
        .toList();
    if (permissions.isEmpty) {
      setState(() => _error = 'List at least one permission key');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    final result = await ref.read(securityActionControllerProvider.notifier).createApiKey(
          name: _nameController.text.trim(),
          scopedPermissions: permissions,
        );
    if (!mounted) return;
    if (result != null) {
      setState(() {
        _submitting = false;
        _createdKey = result.apiKey;
      });
    } else {
      setState(() {
        _submitting = false;
        _error = ref.read(securityActionControllerProvider).errorMessage;
      });
    }
  }
}
