import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../router/routes.dart';
import '../../../../theme/components/voltx_button.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';
import '../widgets/auth_brand_mark.dart';
import '../widgets/auth_scaffold.dart';
import '../widgets/auth_staggered_fade.dart';

/// Welcome landing screen for unauthenticated users.
class WelcomeScreen extends StatelessWidget {
  const WelcomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.voltxColors;
    final textTheme = Theme.of(context).textTheme;

    return AuthScaffold(
      body: AuthStaggeredFade(
        children: [
          const SizedBox(height: AppSpacing.xxl),
          const Center(child: AuthBrandMark()),
          const SizedBox(height: AppSpacing.lg),
          Text(
            'Power your operations\nwith Voltx',
            style: textTheme.headlineMedium,
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Enterprise-grade energy management with clarity and speed.',
            style: textTheme.bodyLarge?.copyWith(color: colors.textSecondary),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: AppSpacing.xxxl),
          VoltxButton(
            label: 'Sign In',
            isExpanded: true,
            size: VoltxButtonSize.large,
            onPressed: () => context.push(AppRoutes.signIn),
          ),
          const SizedBox(height: AppSpacing.sm),
          VoltxButton(
            label: 'Create Account',
            variant: VoltxButtonVariant.secondary,
            isExpanded: true,
            size: VoltxButtonSize.large,
            onPressed: () => context.push(AppRoutes.signUp),
          ),
        ],
      ),
    );
  }
}
