import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../router/routes.dart';
import '../../../../theme/tokens/spacing.dart';
import '../providers/auth_providers.dart';
import '../widgets/auth_email_field.dart';
import '../widgets/auth_form.dart';
import '../widgets/auth_scaffold.dart';
import '../widgets/auth_staggered_fade.dart';
import '../widgets/auth_submit_button.dart';
import '../widgets/auth_success_view.dart';

class ForgotPasswordScreen extends HookConsumerWidget {
  const ForgotPasswordScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final formKey = useMemoized(GlobalKey<FormState>.new);
    final emailController = useTextEditingController();
    final formState = ref.watch(forgotPasswordFormProvider);
    final showSuccess = useState(false);

    ref.listen(forgotPasswordFormProvider, (previous, next) {
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

      await ref.read(forgotPasswordFormProvider.notifier).submit(() async {
        await ref.read(authRepositoryProvider).forgotPassword(
              email: emailController.text,
            );
      }, successMessage: 'email_sent');
    }

    if (showSuccess.value) {
      return AuthScaffold(
        showBackButton: true,
        body: AuthStaggeredFade(
          children: [
            AuthSuccessView(
              title: 'Check your inbox',
              message:
                  'If an account exists for ${emailController.text.trim()}, '
                  'you will receive password reset instructions shortly.',
              actionLabel: 'Back to Sign In',
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
            title: 'Forgot password',
            subtitle: 'Enter your email and we will send reset instructions.',
            errorMessage: errorMessage,
            children: [
              AuthEmailField(
                controller: emailController,
                textInputAction: TextInputAction.done,
                onSubmitted: (_) => submit(),
              ),
              AuthSubmitButton(
                label: 'Send Reset Link',
                formState: formState,
                topSpacing: AppSpacing.lg,
                onPressed: submit,
              ),
            ],
          ),
        ],
      ),
    );
  }
}
