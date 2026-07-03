import 'package:flutter/material.dart';

/// Motion durations and curves — Apple-quality easing.
abstract final class MotionTokens {
  static const Duration instant = Duration(milliseconds: 100);
  static const Duration fast = Duration(milliseconds: 180);
  static const Duration normal = Duration(milliseconds: 280);
  static const Duration slow = Duration(milliseconds: 380);
  static const Duration emphasis = Duration(milliseconds: 520);

  static const Curve standard = Curves.easeOutCubic;
  static const Curve emphasized = Curves.easeOutQuart;
  static const Curve decelerate = Curves.decelerate;
  static const Curve spring = Curves.easeOutBack;

  static Animation<double> fadeIn(AnimationController controller) {
    return CurvedAnimation(parent: controller, curve: standard);
  }
}
