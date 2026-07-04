import 'package:flutter/material.dart';

import '../tokens/spacing.dart';
import '../voltx_theme.dart';

enum VoltxChipVariant { neutral, primary, success, warning, error, info }

/// Compact Voltx chip for filters, tags, and status labels.
class VoltxChip extends StatefulWidget {
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
  State<VoltxChip> createState() => _VoltxChipState();
}

class _VoltxChipState extends State<VoltxChip> {
  bool _hovered = false;
  bool _focused = false;

  @override
  Widget build(BuildContext context) {
    final colors = context.voltxColors;
    final radii = context.voltxRadii;
    final scheme = Theme.of(context).colorScheme;

    final (background, foreground, border) = switch (widget.variant) {
      VoltxChipVariant.neutral => (
          widget.selected ? colors.surfaceMuted : Colors.transparent,
          colors.textSecondary,
          colors.borderSubtle,
        ),
      VoltxChipVariant.primary => (
          widget.selected ? scheme.primary.withValues(alpha: 0.16) : Colors.transparent,
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
      button: widget.onTap != null,
      selected: widget.selected,
      label: widget.label,
      child: FocusableActionDetector(
        onShowFocusHighlight: (value) => setState(() => _focused = value),
        child: MouseRegion(
          onEnter: (_) => setState(() => _hovered = true),
          onExit: (_) => setState(() => _hovered = false),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: widget.onTap,
              borderRadius: radii.fullBorder,
              child: AnimatedContainer(
                duration: context.voltxMotion.fast,
                curve: context.voltxMotion.standardCurve,
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.sm,
                  vertical: AppSpacing.xs,
                ),
                decoration: BoxDecoration(
                  gradient: widget.selected
                      ? LinearGradient(
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                          colors: [
                            background.withValues(alpha: 0.96),
                            background.withValues(alpha: 0.78),
                          ],
                        )
                      : null,
                  color: widget.selected
                      ? null
                      : _hovered
                          ? background.withValues(alpha: 0.65)
                          : background,
                  borderRadius: radii.fullBorder,
                  border: Border.all(
                    color: _focused
                        ? scheme.primary.withValues(alpha: 0.58)
                        : widget.selected
                            ? foreground.withValues(alpha: 0.4)
                            : border,
                  ),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (widget.icon != null) ...[
                      Icon(widget.icon, size: 16, color: foreground),
                      const SizedBox(width: AppSpacing.xxs),
                    ],
                    Text(
                      widget.label,
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                            color: foreground,
                            fontWeight: widget.selected ? FontWeight.w700 : FontWeight.w600,
                          ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
