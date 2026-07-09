import 'dart:async';

import 'package:flutter/material.dart';

import '../tokens/icon_tokens.dart';
import '../tokens/spacing.dart';
import '../voltx_theme.dart';
import 'voltx_text_field.dart';

/// A read-only, tap-to-open field visually matching [VoltxTextField] —
/// used for every picker (industry, country, currency, etc.) so a form
/// mixing typed and picked fields looks like one coherent design system
/// rather than native text fields next to stock dropdowns.
class VoltxSelectorField extends StatefulWidget {
  const VoltxSelectorField({
    required this.onTap,
    this.label,
    this.placeholder = 'Select...',
    this.valueText,
    this.helper,
    this.errorText,
    this.prefixIcon,
    this.enabled = true,
    super.key,
  });

  final String? label;
  final String placeholder;
  /// Null/empty renders the muted [placeholder] instead.
  final String? valueText;
  final String? helper;
  final String? errorText;
  final IconData? prefixIcon;
  final bool enabled;
  final Future<void> Function() onTap;

  @override
  State<VoltxSelectorField> createState() => _VoltxSelectorFieldState();
}

class _VoltxSelectorFieldState extends State<VoltxSelectorField> {
  bool _isOpen = false;

  Future<void> _handleTap() async {
    if (!widget.enabled) return;
    // Best-effort haptic — must never block opening the picker itself
    // (e.g. a platform channel hiccup on some device/OS combination).
    unawaited(voltxSelectionClick());
    setState(() => _isOpen = true);
    await widget.onTap();
    if (mounted) setState(() => _isOpen = false);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.voltxColors;
    final radii = context.voltxRadii;
    final shadows = context.voltxShadows;
    final scheme = Theme.of(context).colorScheme;
    final hasError = widget.errorText != null && widget.errorText!.isNotEmpty;
    final hasValue = widget.valueText != null && widget.valueText!.isNotEmpty;
    final active = _isOpen;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (widget.label != null) ...[
          Text(
            widget.label!,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: active ? scheme.primary : colors.textSecondary,
                  fontWeight: FontWeight.w600,
                ),
          ),
          const SizedBox(height: AppSpacing.xs),
        ],
        AnimatedContainer(
          duration: context.voltxMotion.fast,
          curve: context.voltxMotion.standardCurve,
          decoration: BoxDecoration(
            borderRadius: radii.mdBorder,
            boxShadow: active
                ? [
                    shadows.card.first,
                    BoxShadow(
                      color: scheme.primary.withValues(alpha: 0.16),
                      blurRadius: 12,
                      spreadRadius: -3,
                      offset: const Offset(0, 4),
                    ),
                  ]
                : null,
          ),
          child: Material(
            color: widget.enabled
                ? colors.surfaceMuted.withValues(alpha: active ? 0.9 : 0.76)
                : colors.surfaceMuted.withValues(alpha: 0.5),
            borderRadius: radii.mdBorder,
            child: InkWell(
              onTap: widget.enabled ? _handleTap : null,
              borderRadius: radii.mdBorder,
              child: Container(
                decoration: BoxDecoration(
                  borderRadius: radii.mdBorder,
                  border: Border.all(
                    color: hasError
                        ? colors.error
                        : active
                            ? scheme.primary
                            : colors.borderSubtle,
                    width: active || hasError ? 1.7 : 1,
                  ),
                ),
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.md,
                  vertical: AppSpacing.sm,
                ),
                child: Row(
                  children: [
                    if (widget.prefixIcon != null) ...[
                      Icon(widget.prefixIcon, size: IconTokens.input, color: colors.textSecondary),
                      const SizedBox(width: AppSpacing.sm),
                    ],
                    Expanded(
                      child: Text(
                        hasValue ? widget.valueText! : widget.placeholder,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                              color: hasValue ? colors.textPrimary : colors.textTertiary,
                            ),
                      ),
                    ),
                    Icon(Icons.expand_more, size: IconTokens.input, color: colors.textSecondary),
                  ],
                ),
              ),
            ),
          ),
        ),
        if (hasError) ...[
          const SizedBox(height: AppSpacing.xxs),
          Text(
            widget.errorText!,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.error),
          ),
        ] else if (widget.helper != null) ...[
          const SizedBox(height: AppSpacing.xxs),
          Text(
            widget.helper!,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(color: colors.textTertiary),
          ),
        ],
      ],
    );
  }
}
