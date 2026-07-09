import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../router/routes.dart';
import '../../../../shared/widgets/responsive_layout.dart';
import '../../../../theme/tokens/motion_tokens.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';
import '../providers/onboarding_providers.dart';
import '../widgets/onboarding_business_info_step.dart';
import '../widgets/onboarding_complete_step.dart';
import '../widgets/onboarding_connect_apps_step.dart';
import '../widgets/onboarding_progress_indicator.dart';

/// Steps 3-5 of the Voltx onboarding journey (Business Information, Connect
/// Apps, AI Setup Complete). Welcome and Create Account are the existing
/// welcome/sign-up screens, already completed by the time a session with
/// `onboardingCompleted == false` lands here — see the router redirect.
class OnboardingScreen extends HookConsumerWidget {
  const OnboardingScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.voltxColors;
    final step = ref.watch(onboardingStepProvider);
    final stepIndex = switch (step) {
      OnboardingStep.businessInfo => 2,
      OnboardingStep.connectApps => 3,
      OnboardingStep.complete => 4,
    };

    return Scaffold(
      backgroundColor: colors.surfaceMuted,
      body: SafeArea(
        child: ResponsiveLayout(
          maxContentWidth: 440,
          child: Padding(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.sm,
              vertical: AppSpacing.md,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                OnboardingProgressIndicator(currentIndex: stepIndex),
                const SizedBox(height: AppSpacing.xl),
                Expanded(
                  child: SingleChildScrollView(
                    child: AnimatedSwitcher(
                      duration: MotionTokens.normal,
                      switchInCurve: MotionTokens.standard,
                      switchOutCurve: MotionTokens.standard,
                      transitionBuilder: (child, animation) => FadeTransition(
                        opacity: animation,
                        child: SlideTransition(
                          position: Tween<Offset>(
                            begin: const Offset(0, 0.03),
                            end: Offset.zero,
                          ).animate(animation),
                          child: child,
                        ),
                      ),
                      child: KeyedSubtree(
                        key: ValueKey(step),
                        child: switch (step) {
                          OnboardingStep.businessInfo => const OnboardingBusinessInfoStep(),
                          OnboardingStep.connectApps => const OnboardingConnectAppsStep(),
                          OnboardingStep.complete => OnboardingCompleteStep(
                              onFinished: () => context.go(AppRoutes.dashboard),
                            ),
                        },
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
