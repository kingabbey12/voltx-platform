import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../tokens/icon_tokens.dart';
import '../tokens/spacing.dart';
import '../voltx_theme.dart';

/// Voltx text field with Linear-inspired borders and Apple sizing.
class VoltxTextField extends StatefulWidget {
  const VoltxTextField({
    this.controller,
    this.label,
    this.hint,
    this.helper,
    this.errorText,
    this.prefixIcon,
    this.suffixIcon,
    this.obscureText = false,
    this.enabled = true,
    this.autofocus = false,
    this.keyboardType,
    this.textInputAction,
    this.validator,
    this.onChanged,
    this.onSubmitted,
    super.key,
  });

  final TextEditingController? controller;
  final String? label;
  final String? hint;
  final String? helper;
  final String? errorText;
  final IconData? prefixIcon;
  final Widget? suffixIcon;
  final bool obscureText;
  final bool enabled;
  final bool autofocus;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final FormFieldValidator<String>? validator;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;

  @override
  State<VoltxTextField> createState() => _VoltxTextFieldState();
}

class _VoltxTextFieldState extends State<VoltxTextField> {
  late final FocusNode _focusNode;

  @override
  void initState() {
    super.initState();
    _focusNode = FocusNode()..addListener(_onFocusChanged);
  }

  @override
  void dispose() {
    _focusNode
      ..removeListener(_onFocusChanged)
      ..dispose();
    super.dispose();
  }

  void _onFocusChanged() {
    if (mounted) {
      setState(() {});
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.voltxColors;
    final radii = context.voltxRadii;
    final shadows = context.voltxShadows;
    final scheme = Theme.of(context).colorScheme;
    final focused = _focusNode.hasFocus;
    final hasError = widget.errorText != null && widget.errorText!.isNotEmpty;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (widget.label != null) ...[
          Text(
            widget.label!,
            style: Theme.of(context).textTheme.labelMedium?.copyWith(
                  color: focused ? scheme.primary : colors.textSecondary,
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
            boxShadow: focused
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
          child: TextFormField(
            controller: widget.controller,
            focusNode: _focusNode,
            obscureText: widget.obscureText,
            enabled: widget.enabled,
            autofocus: widget.autofocus,
            keyboardType: widget.keyboardType,
            textInputAction: widget.textInputAction,
            validator: widget.validator,
            onChanged: widget.onChanged,
            onFieldSubmitted: widget.onSubmitted,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: colors.textPrimary,
                ),
            decoration: InputDecoration(
              hintText: widget.hint,
              errorText: hasError ? widget.errorText : null,
              prefixIcon: widget.prefixIcon != null
                  ? Icon(widget.prefixIcon, size: IconTokens.input)
                  : null,
              suffixIcon: widget.suffixIcon,
              filled: true,
              fillColor: widget.enabled
                  ? colors.surfaceMuted.withValues(alpha: focused ? 0.9 : 0.76)
                  : colors.surfaceMuted.withValues(alpha: 0.5),
              contentPadding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.md,
                vertical: AppSpacing.sm,
              ),
              border: OutlineInputBorder(
                borderRadius: radii.mdBorder,
                borderSide: BorderSide(color: colors.borderSubtle),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: radii.mdBorder,
                borderSide: BorderSide(color: colors.borderSubtle),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: radii.mdBorder,
                borderSide: BorderSide(
                  color: scheme.primary,
                  width: 1.7,
                ),
              ),
              errorBorder: OutlineInputBorder(
                borderRadius: radii.mdBorder,
                borderSide: BorderSide(color: colors.error),
              ),
              focusedErrorBorder: OutlineInputBorder(
                borderRadius: radii.mdBorder,
                borderSide: BorderSide(color: colors.error, width: 1.7),
              ),
            ),
          ),
        ),
        if (widget.helper != null && !hasError) ...[
          const SizedBox(height: AppSpacing.xxs),
          Text(
            widget.helper!,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: colors.textTertiary,
                ),
          ),
        ],
      ],
    );
  }
}

/// Applies subtle haptic feedback on supported platforms.
Future<void> voltxSelectionClick() async {
  await HapticFeedback.selectionClick();
}
