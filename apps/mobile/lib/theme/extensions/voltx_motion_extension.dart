import 'package:flutter/material.dart';

import '../tokens/motion_tokens.dart';

@immutable
class VoltxMotionExtension extends ThemeExtension<VoltxMotionExtension> {
  const VoltxMotionExtension({
    required this.instant,
    required this.fast,
    required this.normal,
    required this.slow,
    required this.emphasis,
    required this.standardCurve,
    required this.emphasizedCurve,
    required this.decelerateCurve,
  });

  static const VoltxMotionExtension standard = VoltxMotionExtension(
    instant: MotionTokens.instant,
    fast: MotionTokens.fast,
    normal: MotionTokens.normal,
    slow: MotionTokens.slow,
    emphasis: MotionTokens.emphasis,
    standardCurve: MotionTokens.standard,
    emphasizedCurve: MotionTokens.emphasized,
    decelerateCurve: MotionTokens.decelerate,
  );

  final Duration instant;
  final Duration fast;
  final Duration normal;
  final Duration slow;
  final Duration emphasis;
  final Curve standardCurve;
  final Curve emphasizedCurve;
  final Curve decelerateCurve;

  Duration get pageTransition => normal;

  @override
  VoltxMotionExtension copyWith({
    Duration? instant,
    Duration? fast,
    Duration? normal,
    Duration? slow,
    Duration? emphasis,
    Curve? standardCurve,
    Curve? emphasizedCurve,
    Curve? decelerateCurve,
  }) {
    return VoltxMotionExtension(
      instant: instant ?? this.instant,
      fast: fast ?? this.fast,
      normal: normal ?? this.normal,
      slow: slow ?? this.slow,
      emphasis: emphasis ?? this.emphasis,
      standardCurve: standardCurve ?? this.standardCurve,
      emphasizedCurve: emphasizedCurve ?? this.emphasizedCurve,
      decelerateCurve: decelerateCurve ?? this.decelerateCurve,
    );
  }

  @override
  VoltxMotionExtension lerp(
    ThemeExtension<VoltxMotionExtension>? other,
    double t,
  ) {
    return other is VoltxMotionExtension && t >= 0.5 ? other : this;
  }
}
