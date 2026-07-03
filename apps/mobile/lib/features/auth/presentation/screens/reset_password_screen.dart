import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../router/routes.dart';
import '../../../../theme/components/voltx_text_field.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../data/constants/auth_constants.dart';
import '../../utils/auth_validators.dart';
import '../providers/auth_providers.dart';
import '../widgets/auth_form.dart';
import '../widgets/auth_password_field.dart';
import '../widgets/auth_scaffold.dart';
import '../widgets/auth_staggered_fade.dart';
import '../widgets/auth_submit_button.dart';
import '../widgets/auth_success_view.dart';

class ResetPasswordScreen extends HookConsumerWidget {
  const ResetPasswordScreen({required this.token, super.key});

  final String? token;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final formKey = useMemoized(GlobalKey<FormState>.new);
    final tokenController = useTextEditingController(text: token ?? '');
    final passwordController = useTextEditingController();
    final confirmController = useTextEditingController();
    final obscurePassword = useState(true);
    final formState = ref.watch(resetPasswordFormProvider);
    final showSuccess = useState(false);

    ref.listen(resetPasswordFormProvider, (previous, next) {
      next.whenOrNull(
        data: (message) {
          if (message != null) {
            showSuccess.value = true;
          }
        },
      );
    });

    final errorMessage = formState.maybeWhen(
      error: (error, _) => authErrorMessage(error),
      orElse: () => '',
    );

    Future<void> submit() async {
      if (!(formKey.currentState?.validate() ?? false)) {
        return;
      }

      await ref.read(resetPasswordFormProvider.notifier).submit(() async {
        await ref.read(authRepositoryProvider).resetPassword(
              token: tokenController.text,
              password: passwordController.text,
            );
      }, successMessage: 'password_reset');
    }

    if (showSuccess.value) {
      return AuthScaffold(
        showBackButton: true,
        body: AuthStaggeredFade(
          children: [
            AuthSuccessView(
              title: 'Password updated',
              message:
                  'Your password has been reset. Sign in with your new credentials.',
              actionLabel: 'Sign In',
              onAction: () => context.go(AppRoutes.signIn),
            ),
          ],
        ),
      );
    }

    return AuthScaffold(
      showBackButton: true,
      body: AuthStaggeredFade(
        children: [
          AuthForm(
            formKey: formKey,
            title: 'Reset password',
            subtitle: 'Choose a strong password for your account.',
            errorMessage: errorMessage,
            children: [
              VoltxTextField(
                controller: tokenController,
                label: 'Reset token',
                hint: AuthMockCredentials.validResetToken,
                helper: 'Use mock token: valid-reset-token',
                validator: AuthValidators.resetToken,
              ),
              const SizedBox(height: AppSpacing.sm),
              AuthPasswordField(
                controller: passwordController,
                label: 'New password',
                obscureText: obscurePassword.value,
                onToggleVisibility: () =>
                    obscurePassword.value = !obscurePassword.value,
                useStrengthValidator: true,
                textInputAction: TextInputAction.next,
              ),
              const SizedBox(height: AppSpacing.sm),
              AuthPasswordField(
                controller: confirmController,
                label: 'Confirm password',
                obscureText: obscurePassword.value,
                onToggleVisibility: () =>
                    obscurePassword.value = !obscurePassword.value,
                validator: (v) =>
                    AuthValidators.confirmPassword(v, passwordController.text),
                onSubmitted: (_) => submit(),
              ),
              AuthSubmitButton(
                label: 'Update Password',
                formState: formState,
                onPressed: submit,
              ),
            ],
          ),
        ],
      ),
    );
  }
}
