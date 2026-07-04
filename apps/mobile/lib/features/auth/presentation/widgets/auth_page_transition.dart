import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../../theme/components/voltx_motion.dart';
import '../../../../theme/tokens/motion_tokens.dart';

/// Shared auth route transition — subtle fade and lift.
CustomTransitionPage<T> authTransitionPage<T>({
  required Widget child,
  required GoRouterState state,
}) {
  return CustomTransitionPage<T>(
    key: state.pageKey,
    child: child,
    transitionDuration: MotionTokens.normal,
    reverseTransitionDuration: MotionTokens.fast,
    transitionsBuilder: (context, animation, secondaryAnimation, child) {
      return VoltxPageTransition.fadeSlide(
        context,
        animation,
        secondaryAnimation,
        child,
      );
    },
  );
}
