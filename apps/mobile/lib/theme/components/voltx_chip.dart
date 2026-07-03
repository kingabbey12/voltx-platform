import 'package:flutter/material.dart';

import '../tokens/spacing.dart';
import '../voltx_theme.dart';

enum VoltxChipVariant { neutral, primary, success, warning, error, info }

/// Compact Voltx chip for filters, tags, and status labels.
class VoltxChip extends StatelessWidget {
  const VoltxChip({
    required this.label,
    this.variant = VoltxChipVariant.neutral,
    this.icon,
    this.selected = false,
    this.onTap,
    super.key,
  });

  final String label;
  final VoltxChipVariant variant;
  final IconData? icon;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final colors = context.voltxColors;
    final radii = context.voltxRadii;
    final scheme = Theme.of(context).colorScheme;

    final (background, foreground, border) = switch (variant) {
      VoltxChipVariant.neutral => (
          selected ? colors.surfaceMuted : Colors.transparent,
          colors.textSecondary,
          colors.borderSubtle,
        ),
      VoltxChipVariant.primary => (
          selected ? scheme.primary.withValues(alpha: 0.12) : Colors.transparent,
          scheme.primary,
          scheme.primary.withValues(alpha: 0.24),
        ),
      VoltxChipVariant.success => (
          colors.successSurface,
          colors.success,
          colors.success.withValues(alpha: 0.24),
        ),
      VoltxChipVariant.warning => (
          colors.warningSurface,
          colors.warning,
          colors.warning.withValues(alpha: 0.24),
        ),
      VoltxChipVariant.error => (
          colors.errorSurface,
          colors.error,
          colors.error.withValues(alpha: 0.24),
        ),
      VoltxChipVariant.info => (
          colors.infoSurface,
          colors.info,
          colors.info.withValues(alpha: 0.24),
        ),
    };

    return Semantics(
      button: onTap != null,
      selected: selected,
      label: label,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: radii.fullBorder,
          child: AnimatedContainer(
            duration: context.voltxMotion.fast,
            curve: context.voltxMotion.standardCurve,
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.sm,
              vertical: AppSpacing.xs,
            ),
            decoration: BoxDecoration(
              color: background,
              borderRadius: radii.fullBorder,
              border: Border.all(
                color: selected ? foreground.withValues(alpha: 0.4) : border,
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (icon != null) ...[
                  Icon(icon, size: 16, color: foreground),
                  const SizedBox(width: AppSpacing.xxs),
                ],
                Text(
                  label,
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: foreground,
                      ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
