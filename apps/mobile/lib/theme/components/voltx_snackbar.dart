import 'package:flutter/material.dart';

import '../tokens/spacing.dart';
import '../voltx_theme.dart';

enum VoltxSnackbarVariant { neutral, success, warning, error, info }

/// Shows a Voltx-styled floating snackbar.
ScaffoldFeatureController<SnackBar, SnackBarClosedReason> showVoltxSnackbar(
  BuildContext context, {
  required String message,
  VoltxSnackbarVariant variant = VoltxSnackbarVariant.neutral,
  String? actionLabel,
  VoidCallback? onAction,
  Duration duration = const Duration(seconds: 4),
}) {
  final colors = context.voltxColors;
  final radii = context.voltxRadii;
  final motion = context.voltxMotion;

  final (background, foreground) = switch (variant) {
    VoltxSnackbarVariant.neutral => (
        colors.surfaceElevated,
        colors.textPrimary,
      ),
    VoltxSnackbarVariant.success => (colors.successSurface, colors.success),
    VoltxSnackbarVariant.warning => (colors.warningSurface, colors.warning),
    VoltxSnackbarVariant.error => (colors.errorSurface, colors.error),
    VoltxSnackbarVariant.info => (colors.infoSurface, colors.info),
  };

  final snackBar = SnackBar(
    behavior: SnackBarBehavior.floating,
    duration: duration,
    backgroundColor: background,
    elevation: 0,
    margin: const EdgeInsets.all(AppSpacing.sm),
    shape: RoundedRectangleBorder(
      borderRadius: radii.mdBorder,
      side: BorderSide(color: colors.borderSubtle),
    ),
    content: Text(
      message,
      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
            color: foreground,
          ),
    ),
    action: actionLabel == null
        ? null
        : SnackBarAction(
            label: actionLabel,
            textColor: Theme.of(context).colorScheme.primary,
            onPressed: onAction ?? () {},
          ),
  );

  return ScaffoldMessenger.of(context).showSnackBar(
    snackBar,
    snackBarAnimationStyle: AnimationStyle(
      duration: motion.normal,
      reverseDuration: motion.fast,
      curve: motion.emphasizedCurve,
      reverseCurve: motion.standardCurve,
    ),
  );
}
