import 'dart:ui' show lerpDouble;

import 'package:flutter/material.dart';

import '../tokens/radius_tokens.dart';

@immutable
class VoltxRadiiExtension extends ThemeExtension<VoltxRadiiExtension> {
  const VoltxRadiiExtension({
    required this.xs,
    required this.sm,
    required this.md,
    required this.lg,
    required this.xl,
    required this.full,
  });

  static const VoltxRadiiExtension standard = VoltxRadiiExtension(
    xs: RadiusTokens.xs,
    sm: RadiusTokens.sm,
    md: RadiusTokens.md,
    lg: RadiusTokens.lg,
    xl: RadiusTokens.xl,
    full: RadiusTokens.full,
  );

  final double xs;
  final double sm;
  final double md;
  final double lg;
  final double xl;
  final double full;

  BorderRadius get xsBorder => BorderRadius.circular(xs);
  BorderRadius get smBorder => BorderRadius.circular(sm);
  BorderRadius get mdBorder => BorderRadius.circular(md);
  BorderRadius get lgBorder => BorderRadius.circular(lg);
  BorderRadius get xlBorder => BorderRadius.circular(xl);
  BorderRadius get fullBorder => BorderRadius.circular(full);

  @override
  VoltxRadiiExtension copyWith({
    double? xs,
    double? sm,
    double? md,
    double? lg,
    double? xl,
    double? full,
  }) {
    return VoltxRadiiExtension(
      xs: xs ?? this.xs,
      sm: sm ?? this.sm,
      md: md ?? this.md,
      lg: lg ?? this.lg,
      xl: xl ?? this.xl,
      full: full ?? this.full,
    );
  }

  @override
  VoltxRadiiExtension lerp(
    ThemeExtension<VoltxRadiiExtension>? other,
    double t,
  ) {
    if (other is! VoltxRadiiExtension) {
      return this;
    }

    return VoltxRadiiExtension(
      xs: lerpDouble(xs, other.xs, t)!,
      sm: lerpDouble(sm, other.sm, t)!,
      md: lerpDouble(md, other.md, t)!,
      lg: lerpDouble(lg, other.lg, t)!,
      xl: lerpDouble(xl, other.xl, t)!,
      full: lerpDouble(full, other.full, t)!,
    );
  }
}
