import 'package:flutter/material.dart';

import '../tokens/color_tokens.dart';

/// Semantic color tokens exposed through [ThemeData.extensions].
@immutable
class VoltxColorsExtension extends ThemeExtension<VoltxColorsExtension> {
  const VoltxColorsExtension({
    required this.textPrimary,
    required this.textSecondary,
    required this.textTertiary,
    required this.textInverse,
    required this.borderSubtle,
    required this.borderStrong,
    required this.surfaceMuted,
    required this.surfaceElevated,
    required this.overlay,
    required this.success,
    required this.successSurface,
    required this.warning,
    required this.warningSurface,
    required this.error,
    required this.errorSurface,
    required this.info,
    required this.infoSurface,
  });

  static const VoltxColorsExtension light = VoltxColorsExtension(
    textPrimary: ColorTokens.neutral900,
    textSecondary: ColorTokens.neutral600,
    textTertiary: ColorTokens.neutral500,
    textInverse: ColorTokens.neutral0,
    borderSubtle: ColorTokens.borderLight,
    borderStrong: ColorTokens.borderStrongLight,
    surfaceMuted: ColorTokens.surfaceMutedLight,
    surfaceElevated: ColorTokens.surfaceElevatedLight,
    overlay: ColorTokens.overlayLight,
    success: ColorTokens.success,
    successSurface: ColorTokens.successSurface,
    warning: ColorTokens.warning,
    warningSurface: ColorTokens.warningSurface,
    error: ColorTokens.error,
    errorSurface: ColorTokens.errorSurface,
    info: ColorTokens.info,
    infoSurface: ColorTokens.infoSurface,
  );

  static const VoltxColorsExtension dark = VoltxColorsExtension(
    textPrimary: ColorTokens.neutral50,
    textSecondary: ColorTokens.neutral400,
    textTertiary: ColorTokens.neutral500,
    textInverse: ColorTokens.neutral900,
    borderSubtle: ColorTokens.borderDark,
    borderStrong: ColorTokens.borderStrongDark,
    surfaceMuted: ColorTokens.surfaceMutedDark,
    surfaceElevated: ColorTokens.surfaceElevatedDark,
    overlay: ColorTokens.overlayDark,
    // Semantic colors and their low-alpha surface tints both derive from
    // the same ColorTokens value — previously this hardcoded a second,
    // divergent set of pastel hex literals that didn't match
    // ColorTokens.success/warning/error/info at all.
    success: ColorTokens.success,
    successSurface: Color(0x2900C853),
    warning: ColorTokens.warning,
    warningSurface: Color(0x29FFB300),
    error: ColorTokens.error,
    errorSurface: Color(0x29FF3D57),
    info: ColorTokens.info,
    infoSurface: Color(0x293B82F6),
  );

  final Color textPrimary;
  final Color textSecondary;
  final Color textTertiary;
  final Color textInverse;
  final Color borderSubtle;
  final Color borderStrong;
  final Color surfaceMuted;
  final Color surfaceElevated;
  final Color overlay;
  final Color success;
  final Color successSurface;
  final Color warning;
  final Color warningSurface;
  final Color error;
  final Color errorSurface;
  final Color info;
  final Color infoSurface;

  @override
  VoltxColorsExtension copyWith({
    Color? textPrimary,
    Color? textSecondary,
    Color? textTertiary,
    Color? textInverse,
    Color? borderSubtle,
    Color? borderStrong,
    Color? surfaceMuted,
    Color? surfaceElevated,
    Color? overlay,
    Color? success,
    Color? successSurface,
    Color? warning,
    Color? warningSurface,
    Color? error,
    Color? errorSurface,
    Color? info,
    Color? infoSurface,
  }) {
    return VoltxColorsExtension(
      textPrimary: textPrimary ?? this.textPrimary,
      textSecondary: textSecondary ?? this.textSecondary,
      textTertiary: textTertiary ?? this.textTertiary,
      textInverse: textInverse ?? this.textInverse,
      borderSubtle: borderSubtle ?? this.borderSubtle,
      borderStrong: borderStrong ?? this.borderStrong,
      surfaceMuted: surfaceMuted ?? this.surfaceMuted,
      surfaceElevated: surfaceElevated ?? this.surfaceElevated,
      overlay: overlay ?? this.overlay,
      success: success ?? this.success,
      successSurface: successSurface ?? this.successSurface,
      warning: warning ?? this.warning,
      warningSurface: warningSurface ?? this.warningSurface,
      error: error ?? this.error,
      errorSurface: errorSurface ?? this.errorSurface,
      info: info ?? this.info,
      infoSurface: infoSurface ?? this.infoSurface,
    );
  }

  @override
  VoltxColorsExtension lerp(
    ThemeExtension<VoltxColorsExtension>? other,
    double t,
  ) {
    if (other is! VoltxColorsExtension) {
      return this;
    }

    return VoltxColorsExtension(
      textPrimary: Color.lerp(textPrimary, other.textPrimary, t)!,
      textSecondary: Color.lerp(textSecondary, other.textSecondary, t)!,
      textTertiary: Color.lerp(textTertiary, other.textTertiary, t)!,
      textInverse: Color.lerp(textInverse, other.textInverse, t)!,
      borderSubtle: Color.lerp(borderSubtle, other.borderSubtle, t)!,
      borderStrong: Color.lerp(borderStrong, other.borderStrong, t)!,
      surfaceMuted: Color.lerp(surfaceMuted, other.surfaceMuted, t)!,
      surfaceElevated: Color.lerp(surfaceElevated, other.surfaceElevated, t)!,
      overlay: Color.lerp(overlay, other.overlay, t)!,
      success: Color.lerp(success, other.success, t)!,
      successSurface: Color.lerp(successSurface, other.successSurface, t)!,
      warning: Color.lerp(warning, other.warning, t)!,
      warningSurface: Color.lerp(warningSurface, other.warningSurface, t)!,
      error: Color.lerp(error, other.error, t)!,
      errorSurface: Color.lerp(errorSurface, other.errorSurface, t)!,
      info: Color.lerp(info, other.info, t)!,
      infoSurface: Color.lerp(infoSurface, other.infoSurface, t)!,
    );
  }
}
