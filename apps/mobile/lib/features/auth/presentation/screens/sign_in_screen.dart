import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../core/analytics/analytics_service.dart';
import '../../../../router/routes.dart';
import '../../../../theme/tokens/spacing.dart';
import '../providers/auth_providers.dart';
import '../widgets/auth_email_field.dart';
import '../widgets/auth_form.dart';
import '../widgets/auth_password_field.dart';
import '../widgets/auth_scaffold.dart';
import '../widgets/auth_staggered_fade.dart';
import '../widgets/auth_submit_button.dart';

class SignInScreen extends HookConsumerWidget {
  const SignInScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final formKey = useMemoized(GlobalKey<FormState>.new);
    final emailController = useTextEditingController();
    final passwordController = useTextEditingController();
    final obscurePassword = useState(true);
    final isSubmitting = useState(false);
    final hasCompletedSignIn = useState(false);
    final formState = ref.watch(signInFormProvider);

    final errorMessage = formState.maybeWhen(
      error: (error, _) => authErrorMessage(error),
      orElse: () => '',
    );

    Future<void> submit() async {
      if (isSubmitting.value || hasCompletedSignIn.value) {
        return;
      }

      if (!(formKey.currentState?.validate() ?? false)) {
        return;
      }

      isSubmitting.value = true;
      try {
        await ref.read(signInFormProvider.notifier).submit(() async {
          final user = await ref.read(authRepositoryProvider).signIn(
                email: emailController.text,
                password: passwordController.text,
              );
          ref.read(authSessionProvider.notifier).setUser(user);
        }, successMessage: 'signed_in');

        final isSuccess = ref.read(signInFormProvider).valueOrNull == 'signed_in';
        if (isSuccess && context.mounted) {
          hasCompletedSignIn.value = true;
          ref.read(analyticsServiceProvider).logEvent('sign_in_success');
          context.go(AppRoutes.dashboard);
        }
      } finally {
        if (context.mounted) {
          isSubmitting.value = false;
        }
      }
    }

    return AuthScaffold(
      showBackButton: true,
      body: AuthStaggeredFade(
        children: [
          AuthForm(
            formKey: formKey,
            title: 'Sign in',
            subtitle: 'Welcome back. Enter your credentials to continue.',
            errorMessage: errorMessage,
            children: [
              AuthEmailField(controller: emailController),
              const SizedBox(height: AppSpacing.sm),
              AuthPasswordField(
                controller: passwordController,
                obscureText: obscurePassword.value,
                onToggleVisibility: () =>
                    obscurePassword.value = !obscurePassword.value,
                onSubmitted: (_) => submit(),
              ),
              Align(
                alignment: Alignment.centerRight,
                child: TextButton(
                  onPressed: () => context.push(AppRoutes.forgotPassword),
                  child: const Text('Forgot password?'),
                ),
              ),
              AuthSubmitButton(
                label: 'Sign In',
                formState: formState,
                isSubmitting: isSubmitting.value,
                topSpacing: AppSpacing.sm,
                onPressed: submit,
              ),
              const SizedBox(height: AppSpacing.md),
              Wrap(
                alignment: WrapAlignment.center,
                crossAxisAlignment: WrapCrossAlignment.center,
                children: [
                  Text(
                    'New to Voltx?',
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  TextButton(
                    onPressed: () => context.push(AppRoutes.signUp),
                    child: const Text('Create account'),
                  ),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }
}
