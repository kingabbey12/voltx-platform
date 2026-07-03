import 'package:flutter/material.dart';

import '../tokens/spacing.dart';
import '../voltx_theme.dart';

enum VoltxButtonVariant { primary, secondary, ghost, destructive }

enum VoltxButtonSize { medium, large }

/// Voltx button system with Apple touch targets and Linear minimal styling.
class VoltxButton extends StatelessWidget {
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
  Widget build(BuildContext context) {
    final colors = context.voltxColors;
    final radii = context.voltxRadii;
    final scheme = Theme.of(context).colorScheme;
    final height = size == VoltxButtonSize.large
        ? AppSpacing.buttonHeightLg
        : AppSpacing.buttonHeight;

    final background = switch (variant) {
      VoltxButtonVariant.primary => scheme.primary,
      VoltxButtonVariant.secondary => colors.surfaceMuted,
      VoltxButtonVariant.ghost => Colors.transparent,
      VoltxButtonVariant.destructive => colors.error,
    };

    final foreground = switch (variant) {
      VoltxButtonVariant.primary => colors.textInverse,
      VoltxButtonVariant.secondary => colors.textPrimary,
      VoltxButtonVariant.ghost => scheme.primary,
      VoltxButtonVariant.destructive => colors.textInverse,
    };

    final border = switch (variant) {
      VoltxButtonVariant.secondary => Border.all(color: colors.borderSubtle),
      VoltxButtonVariant.ghost => Border.all(color: colors.borderSubtle),
      _ => null,
    };

    final child = isLoading
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
              if (icon != null) ...[
                Icon(icon, size: 18, color: foreground),
                const SizedBox(width: AppSpacing.xs),
              ],
              Text(
                label,
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: foreground,
                    ),
              ),
            ],
          );

    final button = AnimatedContainer(
      duration: context.voltxMotion.fast,
      curve: context.voltxMotion.standardCurve,
      height: height,
      constraints: BoxConstraints(
        minWidth: isExpanded ? double.infinity : AppSpacing.minTouchTarget,
      ),
      decoration: BoxDecoration(
        color: onPressed == null ? background.withValues(alpha: 0.5) : background,
        borderRadius: radii.mdBorder,
        border: border,
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: isLoading ? null : onPressed,
          borderRadius: radii.mdBorder,
          splashColor: foreground.withValues(alpha: 0.08),
          highlightColor: foreground.withValues(alpha: 0.04),
          child: Center(child: child),
        ),
      ),
    );

    return Semantics(
      button: true,
      enabled: onPressed != null && !isLoading,
      label: label,
      child: button,
    );
  }
}
