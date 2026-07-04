import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../router/routes.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';
import '../../data/services/auth_error_mapper.dart';
import '../../utils/auth_validators.dart';
import '../providers/auth_providers.dart';
import '../widgets/auth_email_field.dart';
import '../widgets/auth_form.dart';
import '../widgets/auth_name_fields.dart';
import '../widgets/auth_password_field.dart';
import '../widgets/auth_scaffold.dart';
import '../widgets/auth_staggered_fade.dart';
import '../widgets/auth_submit_button.dart';

class SignUpScreen extends HookConsumerWidget {
  const SignUpScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final formKey = useMemoized(GlobalKey<FormState>.new);
    final firstNameController = useTextEditingController();
    final lastNameController = useTextEditingController();
    final emailController = useTextEditingController();
    final passwordController = useTextEditingController();
    final confirmController = useTextEditingController();
    final obscurePassword = useState(true);
    final formState = ref.watch(signUpFormProvider);

    ref.listen(signUpFormProvider, (previous, next) {
      next.whenOrNull(
        data: (message) {
          if (message != null && context.mounted) {
            context.go(AppRoutes.verifyEmail);
          }
        },
      );
    });

    final errorState = formState.maybeWhen(
      error: (error, _) => AuthErrorMapper.toUiModel(error),
      orElse: () => const AuthErrorUiModel(message: ''),
    );

    final actionState = errorState.actions.isEmpty
        ? const <AuthErrorUiAction>[]
        : errorState.actions.map((action) {
            if (action.label == 'Sign In') {
              return AuthErrorUiAction(
                label: action.label,
                onPressed: () => context.go(AppRoutes.signIn),
              );
            }
            return AuthErrorUiAction(
              label: action.label,
              onPressed: () {
                emailController.clear();
                ref.read(signUpFormProvider.notifier).reset();
              },
            );
          }).toList();

    Future<void> submit() async {
      if (!(formKey.currentState?.validate() ?? false)) {
        return;
      }

      await ref.read(signUpFormProvider.notifier).submit(() async {
        final user = await ref.read(authRepositoryProvider).signUp(
              email: emailController.text,
              password: passwordController.text,
              firstName: firstNameController.text,
              lastName: lastNameController.text,
            );
        ref.read(authSessionProvider.notifier).setUser(user);
      }, successMessage: 'signed_up');
    }

    return AuthScaffold(
      showBackButton: true,
      body: AuthStaggeredFade(
        children: [
          AuthForm(
            formKey: formKey,
            title: 'Create account',
            subtitle: 'Start your Voltx workspace in minutes.',
            errorMessage: errorState.message,
            children: [
              AuthNameFields(
                firstNameController: firstNameController,
                lastNameController: lastNameController,
              ),
              const SizedBox(height: AppSpacing.sm),
              AuthEmailField(
                controller: emailController,
                label: 'Work email',
              ),
              const SizedBox(height: AppSpacing.sm),
              AuthPasswordField(
                controller: passwordController,
                obscureText: obscurePassword.value,
                onToggleVisibility: () =>
                    obscurePassword.value = !obscurePassword.value,
                useStrengthValidator: true,
                helper: 'At least 8 characters with upper, lower, and number.',
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
              if (actionState.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.sm),
                _buildActionCard(context, actionState),
              ],
              AuthSubmitButton(
                label: 'Create Account',
                formState: formState,
                onPressed: submit,
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildActionCard(BuildContext context, List<AuthErrorUiAction> actions) {
    final colors = context.voltxColors;

    return Container(
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: colors.surfaceElevated.withValues(alpha: 0.7),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'What would you like to do?',
            style: Theme.of(context).textTheme.labelLarge,
          ),
          const SizedBox(height: AppSpacing.xs),
          ...actions.map(
            (action) => Padding(
              padding: const EdgeInsets.only(top: AppSpacing.xs),
              child: TextButton.icon(
                onPressed: action.onPressed ?? () {},
                icon: const Icon(Icons.arrow_forward_rounded, size: 18),
                label: Text(action.label),
                style: TextButton.styleFrom(
                  foregroundColor: colors.info,
                  padding: const EdgeInsets.symmetric(horizontal: 0, vertical: AppSpacing.xs),
                  alignment: Alignment.centerLeft,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
