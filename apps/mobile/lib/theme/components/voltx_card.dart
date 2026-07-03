import 'package:flutter/material.dart';

import '../tokens/spacing.dart';
import '../voltx_theme.dart';

enum VoltxCardVariant { elevated, outlined, flat }

/// Voltx card surfaces with Linear hairlines and soft Apple elevation.
class VoltxCard extends StatelessWidget {
  const VoltxCard({
    required this.child,
    this.variant = VoltxCardVariant.outlined,
    this.padding,
    this.onTap,
    super.key,
  });

  final Widget child;
  final VoltxCardVariant variant;
  final EdgeInsetsGeometry? padding;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.voltxColors;
    final radii = context.voltxRadii;
    final shadows = context.voltxShadows;

    final decoration = BoxDecoration(
      color: switch (variant) {
        VoltxCardVariant.elevated => colors.surfaceElevated,
        VoltxCardVariant.outlined => colors.surfaceElevated,
        VoltxCardVariant.flat => colors.surfaceMuted,
      },
      borderRadius: radii.lgBorder,
      border: variant == VoltxCardVariant.outlined
          ? Border.all(color: colors.borderSubtle)
          : null,
      boxShadow: variant == VoltxCardVariant.elevated ? shadows.card : null,
    );

    final content = Padding(
      padding: padding ?? const EdgeInsets.all(AppSpacing.sm),
      child: child,
    );

    if (onTap == null) {
      return AnimatedContainer(
        duration: context.voltxMotion.fast,
        curve: context.voltxMotion.standardCurve,
        decoration: decoration,
        child: content,
      );
    }

    return AnimatedContainer(
      duration: context.voltxMotion.fast,
      curve: context.voltxMotion.standardCurve,
      decoration: decoration,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: radii.lgBorder,
          child: content,
        ),
      ),
    );
  }
}
