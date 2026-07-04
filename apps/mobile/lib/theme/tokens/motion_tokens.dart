import 'package:flutter/material.dart';

/// Motion durations and curves — Apple-quality easing.
abstract final class MotionTokens {
  static const Duration instant = Duration(milliseconds: 90);
  static const Duration fast = Duration(milliseconds: 160);
  static const Duration normal = Duration(milliseconds: 240);
  static const Duration slow = Duration(milliseconds: 360);
  static const Duration emphasis = Duration(milliseconds: 480);
  static const Duration pageTransition = Duration(milliseconds: 320);
  static const Duration navTransition = Duration(milliseconds: 260);
  static const Duration drawerTransition = Duration(milliseconds: 300);
  static const Duration sidebarTransition = Duration(milliseconds: 280);
  static const Duration shimmerCycle = Duration(milliseconds: 1400);

  static const Curve standard = Curves.easeOutCubic;
  static const Curve emphasized = Curves.easeOutQuart;
  static const Curve decelerate = Curves.decelerate;
  static const Curve spring = Curves.easeOutBack;
  static const Curve springSoft = Curves.elasticOut;

  static Animation<double> fadeIn(AnimationController controller) {
    return CurvedAnimation(parent: controller, curve: standard);
  }
}
