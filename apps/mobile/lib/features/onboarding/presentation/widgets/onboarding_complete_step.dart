import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../theme/components/voltx_button.dart';
import '../../../../theme/tokens/motion_tokens.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../providers/onboarding_providers.dart';

class OnboardingCompleteStep extends HookConsumerWidget {
  const OnboardingCompleteStep({required this.onFinished, super.key});

  /// Called once onboarding is successfully marked complete on the
  /// backend — the router then naturally lands the user on the dashboard
  /// since `session.onboardingCompleted` becomes true.
  final VoidCallback onFinished;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.voltxColors;
    final controller = useAnimationController(duration: MotionTokens.emphasis);
    final actionState = ref.watch(onboardingControllerProvider);
    final session = ref.watch(authSessionProvider);
    final connectedAsync = ref.watch(onboardingConnectedAppsProvider);
    final hasFinished = useRef(false);

    Future<void> finish() async {
      if (hasFinished.value) {
        return;
      }
      final success = await ref.read(onboardingControllerProvider.notifier).finishOnboarding();
      if (success) {
        hasFinished.value = true;
        onFinished();
      }
    }

    useEffect(() {
      controller.forward();
      // Auto-advance shortly after the success animation plays, matching
      // the "opens automatically" requirement, while the button below
      // still lets an impatient user skip the wait entirely.
      final timer = Timer(const Duration(milliseconds: 1400), finish);
      return timer.cancel;
    }, const []);

    final scale = Tween<double>(begin: 0.7, end: 1).animate(
      CurvedAnimation(parent: controller, curve: MotionTokens.spring),
    );
    final fade = CurvedAnimation(parent: controller, curve: MotionTokens.standard);

    final connectedCount = connectedAsync.valueOrNull?.length ?? 0;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Center(
          child: ScaleTransition(
            scale: scale,
            child: FadeTransition(
              opacity: fade,
              child: Container(
                width: 88,
                height: 88,
                decoration: BoxDecoration(
                  color: colors.successSurface,
                  shape: BoxShape.circle,
                ),
                child: Icon(Icons.check_rounded, color: colors.success, size: 44),
              ),
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        Text(
          "You're all set",
          style: Theme.of(context).textTheme.headlineSmall,
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          session != null
              ? '${session.displayName}, your AI workspace is ready to go.'
              : 'Your AI workspace is ready to go.',
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: colors.textSecondary),
          textAlign: TextAlign.center,
        ),
        const SizedBox(height: AppSpacing.lg),
        Container(
          padding: const EdgeInsets.all(AppSpacing.sm),
          decoration: BoxDecoration(
            color: colors.surfaceElevated.withValues(alpha: 0.6),
            borderRadius: context.voltxRadii.mdBorder,
            border: Border.all(color: colors.borderSubtle),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              _SummaryItem(label: 'Connected apps', value: '$connectedCount'),
              _SummaryItem(label: 'AI agents ready', value: '1'),
            ],
          ),
        ),
        if (actionState.errorMessage != null) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(
            actionState.errorMessage!,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.error),
            textAlign: TextAlign.center,
          ),
        ],
        const SizedBox(height: AppSpacing.lg),
        VoltxButton(
          label: 'Go to Dashboard',
          isExpanded: true,
          size: VoltxButtonSize.large,
          isLoading: actionState.isLoading,
          onPressed: finish,
        ),
      ],
    );
  }
}

class _SummaryItem extends StatelessWidget {
  const _SummaryItem({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final colors = context.voltxColors;
    return Column(
      children: [
        Text(value, style: Theme.of(context).textTheme.headlineSmall),
        const SizedBox(height: 2),
        Text(
          label,
          style: Theme.of(context).textTheme.labelSmall?.copyWith(color: colors.textSecondary),
        ),
      ],
    );
  }
}
