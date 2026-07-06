import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../router/routes.dart';
import '../../../../shared/widgets/async_value_view.dart';
import '../../../../theme/components/voltx_button.dart';
import '../../../../theme/components/voltx_card.dart';
import '../../../../theme/components/voltx_text_field.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../../auth/presentation/widgets/auth_password_field.dart';
import '../../../auth/utils/auth_validators.dart';
import '../../data/repositories/invitation_repository.dart';
import '../providers/invitation_providers.dart';

/// Reached via the `voltx://invitations/accept?token=...` deep link (or a
/// manually-entered token as a fallback). Works whether or not the user is
/// already signed in.
class AcceptInvitationScreen extends HookConsumerWidget {
  const AcceptInvitationScreen({required this.token, super.key});

  final String? token;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentToken = token;
    if (currentToken == null || currentToken.isEmpty) {
      return const Scaffold(
        body: Center(child: Text('This invitation link is missing its token.')),
      );
    }

    final preview = ref.watch(invitationPreviewProvider(currentToken));
    final acceptState = ref.watch(acceptInvitationControllerProvider);

    ref.listen(acceptInvitationControllerProvider, (previous, next) {
      final result = next.valueOrNull;
      if (result is AcceptInvitationNewAccount && context.mounted) {
        invalidateOrganizationScopedProviders(ref);
        context.go(AppRoutes.dashboard);
      }
    });

    return Scaffold(
      appBar: AppBar(title: const Text('Accept invitation')),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 480),
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: AsyncValueView(
              value: preview,
              onRetry: () => ref.invalidate(invitationPreviewProvider(currentToken)),
              data: (context, invitationPreview) {
                if (invitationPreview.isExpired ||
                    invitationPreview.status.name != 'pending') {
                  return VoltxCard(
                    child: Padding(
                      padding: const EdgeInsets.all(AppSpacing.md),
                      child: Text(
                        'This invitation is no longer valid. Ask '
                        '${invitationPreview.invitedByName} to send a new one.',
                      ),
                    ),
                  );
                }

                return _AcceptForm(
                  token: currentToken,
                  organizationName: invitationPreview.organizationName,
                  invitedByName: invitationPreview.invitedByName,
                  roleName: invitationPreview.roleName,
                  email: invitationPreview.email,
                  hasExistingAccount: invitationPreview.hasExistingAccount,
                  acceptState: acceptState,
                );
              },
            ),
          ),
        ),
      ),
    );
  }
}

class _AcceptForm extends HookConsumerWidget {
  const _AcceptForm({
    required this.token,
    required this.organizationName,
    required this.invitedByName,
    required this.roleName,
    required this.email,
    required this.hasExistingAccount,
    required this.acceptState,
  });

  final String token;
  final String organizationName;
  final String invitedByName;
  final String roleName;
  final String email;
  final bool hasExistingAccount;
  final AsyncValue<AcceptInvitationResult?> acceptState;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.voltxColors;
    final formKey = useMemoized(GlobalKey<FormState>.new);
    final firstNameController = useTextEditingController();
    final lastNameController = useTextEditingController();
    final passwordController = useTextEditingController();
    final obscurePassword = useState(true);

    final existingAccountResult = acceptState.valueOrNull;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        VoltxCard(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  "You're invited to join $organizationName",
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  '$invitedByName invited $email as $roleName.',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: colors.textSecondary),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        if (existingAccountResult is AcceptInvitationExistingAccount)
          VoltxCard(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(existingAccountResult.message),
                  const SizedBox(height: AppSpacing.md),
                  VoltxButton(
                    label: 'Go to sign in',
                    isExpanded: true,
                    onPressed: () => context.go(AppRoutes.signIn),
                  ),
                ],
              ),
            ),
          )
        else if (hasExistingAccount)
          VoltxCard(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('An account with this email already exists.'),
                  if (acceptState.hasError) ...[
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      AsyncValueView.friendlyMessageFor(acceptState.error!),
                      style: TextStyle(color: Theme.of(context).colorScheme.error),
                    ),
                  ],
                  const SizedBox(height: AppSpacing.md),
                  VoltxButton(
                    label: 'Accept invitation',
                    isExpanded: true,
                    isLoading: acceptState.isLoading,
                    onPressed: () => ref.read(acceptInvitationControllerProvider.notifier).accept(token),
                  ),
                ],
              ),
            ),
          )
        else
          VoltxCard(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Form(
                key: formKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Create your account', style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: AppSpacing.sm),
                    Row(
                      children: [
                        Expanded(
                          child: VoltxTextField(
                            controller: firstNameController,
                            label: 'First name',
                            validator: (v) => AuthValidators.name(v, fieldLabel: 'First name'),
                          ),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        Expanded(
                          child: VoltxTextField(
                            controller: lastNameController,
                            label: 'Last name',
                            validator: (v) => AuthValidators.name(v, fieldLabel: 'Last name'),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    AuthPasswordField(
                      controller: passwordController,
                      obscureText: obscurePassword.value,
                      onToggleVisibility: () => obscurePassword.value = !obscurePassword.value,
                      useStrengthValidator: true,
                    ),
                    if (acceptState.hasError) ...[
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        AsyncValueView.friendlyMessageFor(acceptState.error!),
                        style: TextStyle(color: Theme.of(context).colorScheme.error),
                      ),
                    ],
                    const SizedBox(height: AppSpacing.md),
                    VoltxButton(
                      label: 'Create account & join',
                      isExpanded: true,
                      isLoading: acceptState.isLoading,
                      onPressed: () {
                        if (!(formKey.currentState?.validate() ?? false)) {
                          return;
                        }
                        ref.read(acceptInvitationControllerProvider.notifier).accept(
                              token,
                              password: passwordController.text,
                              firstName: firstNameController.text.trim(),
                              lastName: lastNameController.text.trim(),
                            );
                      },
                    ),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }
}
