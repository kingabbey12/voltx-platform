import 'package:flutter/material.dart';

import '../tokens/icon_tokens.dart';
import '../tokens/spacing.dart';
import '../voltx_theme.dart';

enum VoltxButtonVariant { primary, secondary, ghost, destructive }

enum VoltxButtonSize { medium, large }

/// Voltx button system with Apple touch targets and Linear minimal styling.
class VoltxButton extends StatefulWidget {
  const VoltxButton({
    required this.label,
    required this.onPressed,
    this.variant = VoltxButtonVariant.primary,
    this.size = VoltxButtonSize.medium,
    this.icon,
    this.isExpanded = false,
    this.isLoading = false,
    super.key,
  });

  final String label;
  final VoidCallback? onPressed;
  final VoltxButtonVariant variant;
  final VoltxButtonSize size;
  final IconData? icon;
  final bool isExpanded;
  final bool isLoading;

  @override
  State<VoltxButton> createState() => _VoltxButtonState();
}

class _VoltxButtonState extends State<VoltxButton> {
  bool _hovered = false;
  bool _focused = false;

  @override
  Widget build(BuildContext context) {
    final colors = context.voltxColors;
    final radii = context.voltxRadii;
    final scheme = Theme.of(context).colorScheme;
    final shadows = context.voltxShadows;
    final height = widget.size == VoltxButtonSize.large
        ? AppSpacing.buttonHeightLg
        : AppSpacing.buttonHeight;
    final enabled = widget.onPressed != null && !widget.isLoading;

    final background = switch (widget.variant) {
      VoltxButtonVariant.primary => scheme.primary,
      VoltxButtonVariant.secondary => colors.surfaceMuted,
      VoltxButtonVariant.ghost =>
        _hovered ? scheme.primary.withValues(alpha: 0.1) : Colors.transparent,
      VoltxButtonVariant.destructive => colors.error,
    };

    final foreground = switch (widget.variant) {
      VoltxButtonVariant.primary => colors.textInverse,
      VoltxButtonVariant.secondary => colors.textPrimary,
      VoltxButtonVariant.ghost => scheme.primary,
      VoltxButtonVariant.destructive => colors.textInverse,
    };

    final border = switch (widget.variant) {
      VoltxButtonVariant.secondary => Border.all(color: scheme.primary.withValues(alpha: 0.6)),
      VoltxButtonVariant.ghost => null,
      _ => null,
    };

    final child = widget.isLoading
        ? SizedBox(
            width: 20,
            height: 20,
            child: CircularProgressIndicator(
              strokeWidth: 2,
              color: foreground,
            ),
          )
        : Row(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (widget.icon != null) ...[
                Icon(widget.icon, size: IconTokens.button, color: foreground),
                const SizedBox(width: AppSpacing.xs),
              ],
              Text(
                widget.label,
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: foreground,
                    ),
              ),
            ],
          );

    final decoration = BoxDecoration(
      gradient: widget.variant == VoltxButtonVariant.primary
          ? LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [
                scheme.primary.withValues(alpha: enabled ? 1 : 0.55),
                scheme.primary.withValues(alpha: enabled ? 0.85 : 0.45),
              ],
            )
          : widget.variant == VoltxButtonVariant.destructive
              ? LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [
                    colors.error.withValues(alpha: enabled ? 0.98 : 0.54),
                    colors.error.withValues(alpha: enabled ? 0.86 : 0.46),
                  ],
                )
              : null,
      color: widget.variant == VoltxButtonVariant.primary || widget.variant == VoltxButtonVariant.destructive
          ? null
          : enabled
              ? background
              : background.withValues(alpha: 0.5),
      borderRadius: radii.mdBorder,
      border: _focused
          ? Border.all(color: scheme.primary.withValues(alpha: 0.62), width: 1.3)
          : border,
      boxShadow: widget.variant == VoltxButtonVariant.primary && (_hovered || _focused)
          ? shadows.card
          : null,
    );

    final button = FocusableActionDetector(
      onShowFocusHighlight: (value) => setState(() => _focused = value),
      child: MouseRegion(
        onEnter: (_) => setState(() => _hovered = true),
        onExit: (_) => setState(() => _hovered = false),
        child: AnimatedContainer(
          duration: context.voltxMotion.fast,
          curve: context.voltxMotion.standardCurve,
          height: height,
          constraints: BoxConstraints(
            minWidth: widget.isExpanded ? double.infinity : AppSpacing.minTouchTarget,
          ),
          decoration: decoration,
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: enabled ? widget.onPressed : null,
              borderRadius: radii.mdBorder,
              splashColor: foreground.withValues(alpha: 0.1),
              highlightColor: foreground.withValues(alpha: 0.06),
              hoverColor: foreground.withValues(alpha: 0.05),
              child: Center(child: child),
            ),
          ),
        ),
      ),
    );

    return Semantics(
      button: true,
      enabled: enabled,
      label: widget.label,
      child: button,
    );
  }
}
