import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../router/routes.dart';
import '../../../../theme/components/voltx_text_field.dart';
import '../../utils/auth_validators.dart';
import '../providers/auth_providers.dart';
import '../widgets/auth_form.dart';
import '../widgets/auth_scaffold.dart';
import '../widgets/auth_staggered_fade.dart';
import '../widgets/auth_submit_button.dart';
import '../widgets/auth_success_view.dart';

class VerifyEmailScreen extends HookConsumerWidget {
  const VerifyEmailScreen({this.token, super.key});

  final String? token;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final formKey = useMemoized(GlobalKey<FormState>.new);
    final tokenController = useTextEditingController(text: token ?? '');
    final formState = ref.watch(verifyEmailFormProvider);
    final showSuccess = useState(false);
    final session = ref.watch(authSessionProvider);

    ref.listen(verifyEmailFormProvider, (previous, next) {
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

      await ref.read(verifyEmailFormProvider.notifier).submit(() async {
        await ref.read(authRepositoryProvider).verifyEmail(
              token: tokenController.text,
            );
        final user = ref.read(authSessionProvider);
        if (user != null) {
          ref.read(authSessionProvider.notifier).setUser(
                user.copyWith(emailVerified: true),
              );
        }
      }, successMessage: 'verified');
    }

    if (showSuccess.value) {
      return AuthScaffold(
        showBackButton: true,
        body: AuthStaggeredFade(
          children: [
            AuthSuccessView(
              title: 'Email verified',
              message:
                  'Your email is confirmed. You can now access your Voltx workspace.',
              actionLabel: 'Continue to Sign In',
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
            title: 'Verify your email',
            subtitle: session != null
                ? 'We sent a verification code to ${session.email}.'
                : 'Enter the verification code from your email.',
            errorMessage: errorMessage,
            children: [
              VoltxTextField(
                controller: tokenController,
                label: 'Verification code',
                hint: 'Enter 6+ character code',
                helper: 'Enter the verification code sent to your email.',
                textInputAction: TextInputAction.done,
                prefixIcon: Icons.verified_outlined,
                validator: AuthValidators.verificationToken,
                onSubmitted: (_) => submit(),
              ),
              AuthSubmitButton(
                label: 'Verify Email',
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
