import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../shared/widgets/async_value_view.dart';
import '../../../../theme/components/voltx_card.dart';
import '../../../../theme/components/voltx_snackbar.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../data/models/security_models.dart';
import '../providers/security_providers.dart';
import '../shell/security_nav_bar.dart';

class SecurityPolicyScreen extends ConsumerWidget {
  const SecurityPolicyScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final policy = ref.watch(securityPolicyProvider);

    return Column(
      children: [
        const SecurityNavBar(),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(AppSpacing.md),
            children: [
              Text(
                'Security policy',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                "Applies organization-wide — MFA requirement, password rules, and IP allowlist.",
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: AppSpacing.md),
              AsyncValueView<SecurityPolicy>(
                value: policy,
                onRetry: () => ref.invalidate(securityPolicyProvider),
                data: (context, result) => _PolicyForm(policy: result),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _PolicyForm extends ConsumerStatefulWidget {
  const _PolicyForm({required this.policy});

  final SecurityPolicy policy;

  @override
  ConsumerState<_PolicyForm> createState() => _PolicyFormState();
}

class _PolicyFormState extends ConsumerState<_PolicyForm> {
  late bool _mfaRequired;
  late PasswordPolicy _passwordPolicy;
  late TextEditingController _ipAllowlistController;

  @override
  void initState() {
    super.initState();
    _mfaRequired = widget.policy.mfaRequired;
    _passwordPolicy = widget.policy.passwordPolicy;
    _ipAllowlistController = TextEditingController(text: widget.policy.ipAllowlist.join('\n'));
  }

  @override
  void dispose() {
    _ipAllowlistController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final actionState = ref.watch(securityActionControllerProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (actionState.errorMessage != null) ...[
          InlineErrorCard(message: actionState.errorMessage!),
          const SizedBox(height: AppSpacing.md),
        ],
        VoltxCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Multi-factor authentication', style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: AppSpacing.xs),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Require MFA for all members'),
                value: _mfaRequired,
                onChanged: (value) => setState(() => _mfaRequired = value),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        VoltxCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Password policy', style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: AppSpacing.xs),
              TextFormField(
                initialValue: '${_passwordPolicy.minLength}',
                decoration: const InputDecoration(labelText: 'Minimum length'),
                keyboardType: TextInputType.number,
                onChanged: (value) {
                  final parsed = int.tryParse(value);
                  if (parsed != null) {
                    setState(() => _passwordPolicy = _passwordPolicy.copyWith(minLength: parsed));
                  }
                },
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Require an uppercase letter'),
                value: _passwordPolicy.requireUppercase,
                onChanged: (value) =>
                    setState(() => _passwordPolicy = _passwordPolicy.copyWith(requireUppercase: value)),
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Require a number'),
                value: _passwordPolicy.requireNumber,
                onChanged: (value) =>
                    setState(() => _passwordPolicy = _passwordPolicy.copyWith(requireNumber: value)),
              ),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: const Text('Require a symbol'),
                value: _passwordPolicy.requireSymbol,
                onChanged: (value) =>
                    setState(() => _passwordPolicy = _passwordPolicy.copyWith(requireSymbol: value)),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        VoltxCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('IP allowlist', style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: AppSpacing.xs),
              Text(
                'Exact IPs and/or IPv4 CIDR ranges, one per line. Leave empty to allow any IP.',
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: AppSpacing.xs),
              TextField(
                controller: _ipAllowlistController,
                maxLines: 4,
                decoration: const InputDecoration(hintText: '203.0.113.7\n10.0.0.0/8'),
              ),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        Align(
          alignment: Alignment.centerRight,
          child: FilledButton(
            onPressed: actionState.isLoading ? null : _save,
            child: actionState.isLoading
                ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2))
                : const Text('Save changes'),
          ),
        ),
      ],
    );
  }

  Future<void> _save() async {
    final organizationId = ref.read(authSessionProvider)?.organizationId;
    if (organizationId == null) {
      return;
    }
    final ipAllowlist = _ipAllowlistController.text
        .split(RegExp(r'[\n,]+'))
        .map((line) => line.trim())
        .where((line) => line.isNotEmpty)
        .toList();
    final success = await ref.read(securityActionControllerProvider.notifier).updatePolicy(
          organizationId,
          mfaRequired: _mfaRequired,
          passwordPolicy: _passwordPolicy,
          ipAllowlist: ipAllowlist,
        );
    if (!mounted) return;
    if (success) {
      showVoltxSnackbar(context, message: 'Security policy updated', variant: VoltxSnackbarVariant.success);
    }
  }
}
