import 'dart:ui';

import 'package:flutter/material.dart';

import '../tokens/spacing.dart';
import '../voltx_theme.dart';
import 'voltx_button.dart';
import 'voltx_motion.dart';

/// Voltx dialog with minimal Linear layout and accessible actions.
class VoltxDialog extends StatelessWidget {
  const VoltxDialog({
    required this.title,
    this.message,
    this.content,
    this.primaryActionLabel = 'OK',
    this.secondaryActionLabel,
    this.onPrimaryAction,
    this.onSecondaryAction,
    this.destructive = false,
    super.key,
  });

  final String title;
  final String? message;
  final Widget? content;
  final String primaryActionLabel;
  final String? secondaryActionLabel;
  final VoidCallback? onPrimaryAction;
  final VoidCallback? onSecondaryAction;
  final bool destructive;

  @override
  Widget build(BuildContext context) {
    final colors = context.voltxColors;
    final radii = context.voltxRadii;
    final shadows = context.voltxShadows;

    return Dialog(
      backgroundColor: colors.surfaceElevated.withValues(alpha: 0.9),
      elevation: 0,
      insetPadding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
      shape: RoundedRectangleBorder(
        borderRadius: radii.xlBorder,
        side: BorderSide(color: colors.borderStrong.withValues(alpha: 0.85)),
      ),
      child: ClipRRect(
        borderRadius: radii.xlBorder,
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  colors.surfaceElevated.withValues(alpha: 0.95),
                  colors.surfaceMuted.withValues(alpha: 0.82),
                ],
              ),
              boxShadow: shadows.modal,
              borderRadius: radii.xlBorder,
            ),
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    title,
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                  if (message != null) ...[
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      message!,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: colors.textSecondary,
                          ),
                    ),
                  ],
                  if (content != null) ...[
                    const SizedBox(height: AppSpacing.sm),
                    content!,
                  ],
                  const SizedBox(height: AppSpacing.md),
                  Row(
                    children: [
                      if (secondaryActionLabel != null) ...[
                        Expanded(
                          child: VoltxButton(
                            label: secondaryActionLabel!,
                            variant: VoltxButtonVariant.ghost,
                            onPressed: onSecondaryAction ?? () => Navigator.of(context).pop(false),
                          ),
                        ),
                        const SizedBox(width: AppSpacing.xs),
                      ],
                      Expanded(
                        child: VoltxButton(
                          label: primaryActionLabel,
                          variant: destructive
                              ? VoltxButtonVariant.destructive
                              : VoltxButtonVariant.primary,
                          onPressed: onPrimaryAction ?? () => Navigator.of(context).pop(true),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

Future<T?> showVoltxDialog<T>({
  required BuildContext context,
  required String title,
  String? message,
  Widget? content,
  String primaryActionLabel = 'OK',
  String? secondaryActionLabel,
  VoidCallback? onPrimaryAction,
  VoidCallback? onSecondaryAction,
  bool destructive = false,
  bool barrierDismissible = true,
}) {
  return showGeneralDialog<T>(
    context: context,
    barrierDismissible: barrierDismissible,
    barrierColor: context.voltxColors.overlay,
    barrierLabel: MaterialLocalizations.of(context).modalBarrierDismissLabel,
    transitionDuration: context.voltxMotion.normal,
    transitionBuilder: (context, animation, secondaryAnimation, child) {
      return VoltxPageTransition.fadeSlide(
        context,
        animation,
        secondaryAnimation,
        ScaleTransition(
          scale: Tween<double>(begin: 0.95, end: 1).animate(
            CurvedAnimation(
              parent: animation,
              curve: context.voltxMotion.springCurve,
              reverseCurve: context.voltxMotion.decelerateCurve,
            ),
          ),
          child: child,
        ),
      );
    },
    pageBuilder: (context, _, _) {
      return VoltxDialog(
        title: title,
        message: message,
        content: content,
        primaryActionLabel: primaryActionLabel,
        secondaryActionLabel: secondaryActionLabel,
        onPrimaryAction: onPrimaryAction,
        onSecondaryAction: onSecondaryAction,
        destructive: destructive,
      );
    },
    routeSettings: const RouteSettings(name: 'voltx-dialog'),
    requestFocus: true,
  );
}
