import 'package:flutter/material.dart';

import '../../../../theme/tokens/motion_tokens.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';

const List<String> onboardingStepLabels = [
  'Welcome',
  'Account',
  'Business',
  'Connect',
  'Ready',
];

/// 5-segment progress bar for the onboarding journey. Segments up to and
/// including [currentIndex] are filled — Welcome and Create Account (index
/// 0-1) are always complete by the time this route is reachable, so
/// [currentIndex] is always >= 2 here.
class OnboardingProgressIndicator extends StatelessWidget {
  const OnboardingProgressIndicator({
    required this.currentIndex,
    super.key,
  });

  final int currentIndex;

  @override
  Widget build(BuildContext context) {
    final colors = context.voltxColors;
    final scheme = Theme.of(context).colorScheme;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            for (var i = 0; i < onboardingStepLabels.length; i++) ...[
              if (i > 0) const SizedBox(width: AppSpacing.xxs),
              Expanded(
                child: AnimatedContainer(
                  duration: MotionTokens.normal,
                  curve: MotionTokens.standard,
                  height: 4,
                  decoration: BoxDecoration(
                    color: i <= currentIndex ? scheme.primary : colors.borderSubtle,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              ),
            ],
          ],
        ),
        const SizedBox(height: AppSpacing.xs),
        Text(
          'Step ${currentIndex + 1} of ${onboardingStepLabels.length} • '
          '${onboardingStepLabels[currentIndex]}',
          style: Theme.of(context).textTheme.labelMedium?.copyWith(
                color: colors.textSecondary,
              ),
        ),
      ],
    );
  }
}
