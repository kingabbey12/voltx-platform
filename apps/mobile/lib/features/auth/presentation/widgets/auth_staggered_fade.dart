import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';

import '../../../../theme/tokens/motion_tokens.dart';

/// Staggered fade-and-rise entrance for auth screen content.
class AuthStaggeredFade extends HookWidget {
  const AuthStaggeredFade({
    required this.children,
    this.interval = 0.08,
    super.key,
  });

  final List<Widget> children;
  final double interval;

  @override
  Widget build(BuildContext context) {
    final controller = useAnimationController(
      duration: MotionTokens.emphasis,
    );

    useEffect(() {
      controller.forward();
      return null;
    }, const []);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        for (var i = 0; i < children.length; i++)
          FadeTransition(
            opacity: CurvedAnimation(
              parent: controller,
              curve: Interval(
                (i * interval).clamp(0.0, 0.85),
                ((i * interval) + 0.45).clamp(0.15, 1.0),
                curve: MotionTokens.standard,
              ),
            ),
            child: SlideTransition(
              position: Tween<Offset>(
                begin: const Offset(0, 0.06),
                end: Offset.zero,
              ).animate(
                CurvedAnimation(
                  parent: controller,
                  curve: Interval(
                    (i * interval).clamp(0.0, 0.85),
                    ((i * interval) + 0.45).clamp(0.15, 1.0),
                    curve: MotionTokens.emphasized,
                  ),
                ),
              ),
              child: children[i],
            ),
          ),
      ],
    );
  }
}
