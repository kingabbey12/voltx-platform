import 'package:flutter/material.dart';

import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';

/// Animated typing indicator for streaming responses.
class TypingIndicator extends StatefulWidget {
  const TypingIndicator({super.key});

  @override
  State<TypingIndicator> createState() => _TypingIndicatorState();
}

class _TypingIndicatorState extends State<TypingIndicator>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(3, (index) {
        return AnimatedBuilder(
          animation: _controller,
          builder: (context, child) {
            final delay = index * 0.2;
            final value = (_controller.value - delay).clamp(0.0, 1.0);
            final opacity = (Curves.easeInOut.transform(value) * 2).clamp(0.3, 1.0);
            return Container(
              margin: const EdgeInsets.symmetric(horizontal: 3),
              width: 8,
              height: 8,
              decoration: BoxDecoration(
                color: scheme.primary.withValues(alpha: opacity),
                shape: BoxShape.circle,
              ),
            );
          },
        );
      }),
    );
  }
}

/// Token usage indicator bar.
class TokenUsageIndicator extends StatelessWidget {
  const TokenUsageIndicator({
    required this.tokensUsed,
    required this.contextWindow,
    super.key,
  });

  final int tokensUsed;
  final int contextWindow;

  @override
  Widget build(BuildContext context) {
    final colors = context.voltxColors;
    final ratio = (tokensUsed / contextWindow).clamp(0.0, 1.0);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Token usage',
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: colors.textSecondary,
                  ),
            ),
            Text(
              '${_format(tokensUsed)} / ${_format(contextWindow)}',
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: colors.textTertiary,
                  ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.xxs),
        ClipRRect(
          borderRadius: BorderRadius.circular(999),
          child: LinearProgressIndicator(
            value: ratio,
            minHeight: 4,
            backgroundColor: colors.surfaceMuted,
            color: ratio > 0.8 ? colors.warning : Theme.of(context).colorScheme.primary,
          ),
        ),
      ],
    );
  }

  String _format(int n) {
    if (n >= 1000) {
      return '${(n / 1000).toStringAsFixed(1)}K';
    }
    return '$n';
  }
}
