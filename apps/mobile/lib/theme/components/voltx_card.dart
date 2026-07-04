import 'package:flutter/material.dart';

import '../tokens/spacing.dart';
import '../voltx_theme.dart';

enum VoltxCardVariant { elevated, outlined, flat }

/// Voltx card surfaces with Linear hairlines and soft Apple elevation.
class VoltxCard extends StatefulWidget {
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
  State<VoltxCard> createState() => _VoltxCardState();
}

class _VoltxCardState extends State<VoltxCard> {
  bool _hovered = false;
  bool _focused = false;

  @override
  Widget build(BuildContext context) {
    final colors = context.voltxColors;
    final radii = context.voltxRadii;
    final shadows = context.voltxShadows;
    final scheme = Theme.of(context).colorScheme;
    final interactive = widget.onTap != null;

    final borderColor = _focused
        ? scheme.primary.withValues(alpha: 0.55)
        : _hovered
            ? colors.borderStrong
            : colors.borderSubtle;

    final decoration = BoxDecoration(
      gradient: LinearGradient(
        begin: Alignment.topLeft,
        end: Alignment.bottomRight,
        colors: switch (widget.variant) {
          VoltxCardVariant.elevated => [
              colors.surfaceElevated.withValues(alpha: 0.96),
              colors.surfaceMuted.withValues(alpha: 0.78),
            ],
          VoltxCardVariant.outlined => [
              colors.surfaceElevated.withValues(alpha: 0.92),
              colors.surfaceMuted.withValues(alpha: 0.68),
            ],
          VoltxCardVariant.flat => [
              colors.surfaceMuted.withValues(alpha: 0.84),
              colors.surfaceMuted.withValues(alpha: 0.72),
            ],
        },
      ),
      color: switch (widget.variant) {
        VoltxCardVariant.elevated => colors.surfaceElevated,
        VoltxCardVariant.outlined => colors.surfaceElevated,
        VoltxCardVariant.flat => colors.surfaceMuted,
      },
      borderRadius: radii.lgBorder,
      border: widget.variant == VoltxCardVariant.outlined || interactive
          ? Border.all(color: borderColor)
          : null,
      boxShadow: widget.variant == VoltxCardVariant.elevated || _hovered
          ? shadows.card
          : null,
    );

    final content = Padding(
      padding: widget.padding ?? const EdgeInsets.all(AppSpacing.sm),
      child: widget.child,
    );

    if (!interactive) {
      return AnimatedContainer(
        duration: context.voltxMotion.fast,
        curve: context.voltxMotion.standardCurve,
        decoration: decoration,
        child: content,
      );
    }

    return FocusableActionDetector(
      onShowFocusHighlight: (value) => setState(() => _focused = value),
      child: MouseRegion(
        onEnter: (_) => setState(() => _hovered = true),
        onExit: (_) => setState(() => _hovered = false),
        child: AnimatedContainer(
          duration: context.voltxMotion.fast,
          curve: context.voltxMotion.standardCurve,
          decoration: decoration,
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: widget.onTap,
              borderRadius: radii.lgBorder,
              splashColor: scheme.primary.withValues(alpha: 0.08),
              highlightColor: scheme.primary.withValues(alpha: 0.04),
              child: content,
            ),
          ),
        ),
      ),
    );
  }
}
