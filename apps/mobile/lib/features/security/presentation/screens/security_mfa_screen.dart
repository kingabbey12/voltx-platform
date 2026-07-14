import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../theme/components/voltx_card.dart';
import '../../../../theme/components/voltx_snackbar.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../data/models/security_models.dart';
import '../providers/security_providers.dart';
import '../shell/security_nav_bar.dart';

class SecurityMfaScreen extends ConsumerWidget {
  const SecurityMfaScreen({super.key});

  Future<void> _refreshCurrentUser(WidgetRef ref) async {
    final user = await ref.read(authApiServiceProvider).getMe();
    ref.read(authSessionProvider.notifier).setUser(user);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(authSessionProvider);
    final actionState = ref.watch(securityActionControllerProvider);
    final mfaEnabled = user?.mfaEnabled ?? false;

    return Column(
      children: [
        const SecurityNavBar(),
        Expanded(
          child: ListView(
            padding: const EdgeInsets.all(AppSpacing.md),
            children: [
              Text(
                'Multi-factor authentication',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(
                'Add a second factor to your own login using any TOTP authenticator app.',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
              const SizedBox(height: AppSpacing.md),
              VoltxCard(
                child: Row(
                  children: [
                    Icon(
                      mfaEnabled ? Icons.verified_user_rounded : Icons.gpp_maybe_outlined,
                      color: mfaEnabled ? context.voltxColors.success : context.voltxColors.textSecondary,
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            mfaEnabled ? 'MFA is enabled' : 'MFA is not enabled',
                            style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
                          ),
                          Text(
                            mfaEnabled
                                ? "You'll be asked for a code at every login from a new device."
                                : 'Enable it to protect your account with a second factor.',
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.md),
              if (!mfaEnabled)
                FilledButton.icon(
                  onPressed: actionState.isLoading ? null : () => _startEnroll(context, ref),
                  icon: const Icon(Icons.add_moderator_outlined),
                  label: const Text('Enable MFA'),
                )
              else
                Wrap(
                  spacing: AppSpacing.sm,
                  children: [
                    OutlinedButton.icon(
                      onPressed: actionState.isLoading ? null : () => _regenerateBackupCodes(context, ref),
                      icon: const Icon(Icons.password_rounded),
                      label: const Text('New backup codes'),
                    ),
                    OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(foregroundColor: context.voltxColors.error),
                      onPressed: actionState.isLoading ? null : () => _disable(context, ref),
                      icon: const Icon(Icons.remove_moderator_outlined),
                      label: const Text('Disable'),
                    ),
                  ],
                ),
            ],
          ),
        ),
      ],
    );
  }

  Future<void> _startEnroll(BuildContext context, WidgetRef ref) async {
    final controller = ref.read(securityActionControllerProvider.notifier);
    final setup = await controller.setupMfa();
    if (!context.mounted) return;
    if (setup == null) {
      showVoltxSnackbar(
        context,
        message: ref.read(securityActionControllerProvider).errorMessage ?? 'Unable to start MFA setup',
        variant: VoltxSnackbarVariant.error,
      );
      return;
    }
    final codes = await showDialog<MfaBackupCodesResult>(
      context: context,
      builder: (context) => _EnrollDialog(setup: setup),
    );
    if (!context.mounted || codes == null) return;
    await _refreshCurrentUser(ref);
    if (!context.mounted) return;
    showVoltxSnackbar(context, message: 'Multi-factor authentication enabled', variant: VoltxSnackbarVariant.success);
    await showDialog<void>(context: context, builder: (context) => _BackupCodesDialog(codes: codes.backupCodes));
  }

  Future<void> _disable(BuildContext context, WidgetRef ref) async {
    final code = await showDialog<String>(context: context, builder: (context) => const _CodePromptDialog(
      title: 'Disable multi-factor authentication',
      description: 'Enter a current code from your authenticator app, or an unused backup code.',
      confirmLabel: 'Disable MFA',
      destructive: true,
    ));
    if (code == null || code.isEmpty || !context.mounted) return;
    final success = await ref.read(securityActionControllerProvider.notifier).disableMfa(code);
    if (!context.mounted) return;
    if (success) {
      await _refreshCurrentUser(ref);
      if (!context.mounted) return;
      showVoltxSnackbar(context, message: 'Multi-factor authentication disabled', variant: VoltxSnackbarVariant.success);
    } else {
      showVoltxSnackbar(
        context,
        message: ref.read(securityActionControllerProvider).errorMessage ?? 'Unable to disable MFA',
        variant: VoltxSnackbarVariant.error,
      );
    }
  }

  Future<void> _regenerateBackupCodes(BuildContext context, WidgetRef ref) async {
    final code = await showDialog<String>(context: context, builder: (context) => const _CodePromptDialog(
      title: 'Regenerate backup codes',
      description: 'Enter a current TOTP code or an unused backup code. Old codes stop working immediately.',
      confirmLabel: 'Regenerate',
    ));
    if (code == null || code.isEmpty || !context.mounted) return;
    final result = await ref.read(securityActionControllerProvider.notifier).regenerateBackupCodes(code);
    if (!context.mounted) return;
    if (result == null) {
      showVoltxSnackbar(
        context,
        message: ref.read(securityActionControllerProvider).errorMessage ?? 'Unable to regenerate codes',
        variant: VoltxSnackbarVariant.error,
      );
      return;
    }
    showVoltxSnackbar(context, message: 'New backup codes issued', variant: VoltxSnackbarVariant.success);
    await showDialog<void>(context: context, builder: (context) => _BackupCodesDialog(codes: result.backupCodes));
  }
}

class _EnrollDialog extends ConsumerStatefulWidget {
  const _EnrollDialog({required this.setup});

  final MfaSetupResult setup;

  @override
  ConsumerState<_EnrollDialog> createState() => _EnrollDialogState();
}

class _EnrollDialogState extends ConsumerState<_EnrollDialog> {
  final _codeController = TextEditingController();
  bool _submitting = false;
  String? _error;

  @override
  void dispose() {
    _codeController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Enable multi-factor authentication'),
      content: SizedBox(
        width: 360,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Add this account to your authenticator app, then enter the 6-digit code it shows.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text('Secret key (manual entry)', style: Theme.of(context).textTheme.labelMedium),
            const SizedBox(height: AppSpacing.xxs),
            Row(
              children: [
                Expanded(
                  child: SelectableText(widget.setup.secret, style: Theme.of(context).textTheme.bodySmall),
                ),
                IconButton(
                  icon: const Icon(Icons.copy_rounded, size: 18),
                  onPressed: () {
                    Clipboard.setData(ClipboardData(text: widget.setup.secret));
                    showVoltxSnackbar(context, message: 'Copied to clipboard');
                  },
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            TextField(
              controller: _codeController,
              decoration: const InputDecoration(labelText: '6-digit code'),
              keyboardType: TextInputType.number,
              autofocus: true,
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
              : const Text('Verify & enable'),
        ),
      ],
    );
  }

  Future<void> _submit() async {
    if (_codeController.text.trim().isEmpty) {
      setState(() => _error = 'Enter the code from your authenticator app');
      return;
    }
    setState(() {
      _submitting = true;
      _error = null;
    });
    final result =
        await ref.read(securityActionControllerProvider.notifier).verifyMfaSetup(_codeController.text.trim());
    if (!mounted) return;
    if (result != null) {
      Navigator.of(context).pop(result);
    } else {
      setState(() {
        _submitting = false;
        _error = ref.read(securityActionControllerProvider).errorMessage;
      });
    }
  }
}

class _BackupCodesDialog extends StatelessWidget {
  const _BackupCodesDialog({required this.codes});

  final List<String> codes;

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: const Text('Your backup codes'),
      content: SizedBox(
        width: 360,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              "Save these somewhere safe — each can be used once if you lose access to your "
              "authenticator app. They're shown exactly once.",
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: AppSpacing.sm),
            Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.xs,
              children: [for (final code in codes) SelectableText(code, style: Theme.of(context).textTheme.bodyMedium)],
            ),
          ],
        ),
      ),
      actions: [
        TextButton(
          onPressed: () {
            Clipboard.setData(ClipboardData(text: codes.join('\n')));
            showVoltxSnackbar(context, message: 'Copied to clipboard');
          },
          child: const Text('Copy all'),
        ),
        FilledButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Done')),
      ],
    );
  }
}

class _CodePromptDialog extends StatefulWidget {
  const _CodePromptDialog({
    required this.title,
    required this.description,
    required this.confirmLabel,
    this.destructive = false,
  });

  final String title;
  final String description;
  final String confirmLabel;
  final bool destructive;

  @override
  State<_CodePromptDialog> createState() => _CodePromptDialogState();
}

class _CodePromptDialogState extends State<_CodePromptDialog> {
  final _controller = TextEditingController();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.title),
      content: SizedBox(
        width: 360,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(widget.description, style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: AppSpacing.sm),
            TextField(
              controller: _controller,
              decoration: const InputDecoration(labelText: 'Code'),
              autofocus: true,
            ),
          ],
        ),
      ),
      actions: [
        TextButton(onPressed: () => Navigator.of(context).pop(), child: const Text('Cancel')),
        widget.destructive
            ? FilledButton.tonal(
                style: FilledButton.styleFrom(
                  backgroundColor: context.voltxColors.errorSurface,
                  foregroundColor: context.voltxColors.error,
                ),
                onPressed: () => Navigator.of(context).pop(_controller.text.trim()),
                child: Text(widget.confirmLabel),
              )
            : FilledButton(
                onPressed: () => Navigator.of(context).pop(_controller.text.trim()),
                child: Text(widget.confirmLabel),
              ),
      ],
    );
  }
}
