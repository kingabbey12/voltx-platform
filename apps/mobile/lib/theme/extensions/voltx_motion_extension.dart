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
    required this.page,
    required this.navigation,
    required this.drawer,
    required this.sidebar,
    required this.shimmer,
    required this.standardCurve,
    required this.emphasizedCurve,
    required this.decelerateCurve,
    required this.springCurve,
  });

  static const VoltxMotionExtension standard = VoltxMotionExtension(
    instant: MotionTokens.instant,
    fast: MotionTokens.fast,
    normal: MotionTokens.normal,
    slow: MotionTokens.slow,
    emphasis: MotionTokens.emphasis,
    page: MotionTokens.pageTransition,
    navigation: MotionTokens.navTransition,
    drawer: MotionTokens.drawerTransition,
    sidebar: MotionTokens.sidebarTransition,
    shimmer: MotionTokens.shimmerCycle,
    standardCurve: MotionTokens.standard,
    emphasizedCurve: MotionTokens.emphasized,
    decelerateCurve: MotionTokens.decelerate,
    springCurve: MotionTokens.spring,
  );

  final Duration instant;
  final Duration fast;
  final Duration normal;
  final Duration slow;
  final Duration emphasis;
  final Duration page;
  final Duration navigation;
  final Duration drawer;
  final Duration sidebar;
  final Duration shimmer;
  final Curve standardCurve;
  final Curve emphasizedCurve;
  final Curve decelerateCurve;
  final Curve springCurve;

  Duration get pageTransition => page;

  @override
  VoltxMotionExtension copyWith({
    Duration? instant,
    Duration? fast,
    Duration? normal,
    Duration? slow,
    Duration? emphasis,
    Duration? page,
    Duration? navigation,
    Duration? drawer,
    Duration? sidebar,
    Duration? shimmer,
    Curve? standardCurve,
    Curve? emphasizedCurve,
    Curve? decelerateCurve,
    Curve? springCurve,
  }) {
    return VoltxMotionExtension(
      instant: instant ?? this.instant,
      fast: fast ?? this.fast,
      normal: normal ?? this.normal,
      slow: slow ?? this.slow,
      emphasis: emphasis ?? this.emphasis,
      page: page ?? this.page,
      navigation: navigation ?? this.navigation,
      drawer: drawer ?? this.drawer,
      sidebar: sidebar ?? this.sidebar,
      shimmer: shimmer ?? this.shimmer,
      standardCurve: standardCurve ?? this.standardCurve,
      emphasizedCurve: emphasizedCurve ?? this.emphasizedCurve,
      decelerateCurve: decelerateCurve ?? this.decelerateCurve,
      springCurve: springCurve ?? this.springCurve,
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
