import 'package:flutter/material.dart';

import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';

@immutable
class DashboardV2Tokens {
  const DashboardV2Tokens({
    required this.backdrop,
    required this.panel,
    required this.panelStrong,
    required this.border,
    required this.borderStrong,
    required this.glow,
    required this.success,
    required this.warning,
    required this.error,
    required this.primary,
    required this.textPrimary,
    required this.textSecondary,
    required this.textTertiary,
    required this.cardShadow,
    required this.durationFast,
    required this.durationNormal,
    required this.durationSlow,
    required this.standardCurve,
    required this.emphasizedCurve,
    required this.radiusLg,
    required this.radiusXl,
    required this.radiusPill,
  });

  final Color backdrop;
  final Color panel;
  final Color panelStrong;
  final Color border;
  final Color borderStrong;
  final Color glow;
  final Color success;
  final Color warning;
  final Color error;
  final Color primary;
  final Color textPrimary;
  final Color textSecondary;
  final Color textTertiary;
  final List<BoxShadow> cardShadow;
  final Duration durationFast;
  final Duration durationNormal;
  final Duration durationSlow;
  final Curve standardCurve;
  final Curve emphasizedCurve;
  final double radiusLg;
  final double radiusXl;
  final double radiusPill;

  static DashboardV2Tokens of(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final colors = context.voltxColors;
    final motion = context.voltxMotion;
    final radii = context.voltxRadii;

    return DashboardV2Tokens(
      backdrop: scheme.surface,
      panel: colors.surfaceElevated,
      panelStrong: colors.surfaceMuted,
      border: colors.borderSubtle,
      borderStrong: colors.borderStrong,
      glow: scheme.primary.withValues(alpha: 0.16),
      success: colors.success,
      warning: colors.warning,
      error: colors.error,
      primary: scheme.primary,
      textPrimary: colors.textPrimary,
      textSecondary: colors.textSecondary,
      textTertiary: colors.textTertiary,
      cardShadow: context.voltxShadows.card,
      durationFast: motion.fast,
      durationNormal: motion.normal,
      durationSlow: motion.slow,
      standardCurve: motion.standardCurve,
      emphasizedCurve: motion.emphasizedCurve,
      radiusLg: radii.lg,
      radiusXl: radii.xl,
      radiusPill: radii.full,
    );
  }

  EdgeInsets get pagePadding => const EdgeInsets.all(AppSpacing.md);
  EdgeInsets get cardPadding => const EdgeInsets.all(AppSpacing.md);
}
