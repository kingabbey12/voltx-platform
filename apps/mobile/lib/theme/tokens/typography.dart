import 'package:flutter/material.dart';

import 'color_tokens.dart';

/// Voltx typography — SF Pro–inspired hierarchy with tight Linear headings.
abstract final class AppTypography {
  static const String fontFamily = '.AppleSystemUIFont';

  static TextTheme textTheme(Brightness brightness) {
    final primary = brightness == Brightness.light
        ? ColorTokens.neutral900
        : ColorTokens.neutral50;
    final secondary = brightness == Brightness.light
        ? ColorTokens.neutral600
        : ColorTokens.neutral400;
    final tertiary = brightness == Brightness.light
        ? ColorTokens.neutral500
        : ColorTokens.neutral500;

    return TextTheme(
      displayLarge: TextStyle(
        fontSize: 57,
        fontWeight: FontWeight.w700,
        fontFamily: fontFamily,
        letterSpacing: -1.2,
        height: 1.1,
        color: primary,
      ),
      displayMedium: TextStyle(
        fontSize: 45,
        fontWeight: FontWeight.w700,
        fontFamily: fontFamily,
        letterSpacing: -0.8,
        height: 1.15,
        color: primary,
      ),
      displaySmall: TextStyle(
        fontSize: 36,
        fontWeight: FontWeight.w600,
        fontFamily: fontFamily,
        letterSpacing: -0.5,
        height: 1.2,
        color: primary,
      ),
      headlineLarge: TextStyle(
        fontSize: 30,
        fontWeight: FontWeight.w700,
        fontFamily: fontFamily,
        letterSpacing: -0.4,
        height: 1.2,
        color: primary,
      ),
      headlineMedium: TextStyle(
        fontSize: 26,
        fontWeight: FontWeight.w700,
        fontFamily: fontFamily,
        letterSpacing: -0.3,
        height: 1.22,
        color: primary,
      ),
      headlineSmall: TextStyle(
        fontSize: 22,
        fontWeight: FontWeight.w700,
        fontFamily: fontFamily,
        letterSpacing: -0.2,
        height: 1.24,
        color: primary,
      ),
      titleLarge: TextStyle(
        fontSize: 20,
        fontWeight: FontWeight.w700,
        fontFamily: fontFamily,
        letterSpacing: -0.15,
        height: 1.26,
        color: primary,
      ),
      titleMedium: TextStyle(
        fontSize: 16,
        fontWeight: FontWeight.w600,
        fontFamily: fontFamily,
        letterSpacing: -0.05,
        height: 1.35,
        color: primary,
      ),
      titleSmall: TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w600,
        fontFamily: fontFamily,
        letterSpacing: 0,
        height: 1.34,
        color: primary,
      ),
      bodyLarge: TextStyle(
        fontSize: 15,
        fontWeight: FontWeight.w400,
        fontFamily: fontFamily,
        letterSpacing: -0.08,
        height: 1.5,
        color: primary,
      ),
      bodyMedium: TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w400,
        fontFamily: fontFamily,
        letterSpacing: -0.05,
        height: 1.45,
        color: primary,
      ),
      bodySmall: TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w400,
        fontFamily: fontFamily,
        letterSpacing: 0,
        height: 1.42,
        color: secondary,
      ),
      labelLarge: TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w700,
        fontFamily: fontFamily,
        letterSpacing: -0.04,
        height: 1.2,
        color: primary,
      ),
      labelMedium: TextStyle(
        fontSize: 13,
        fontWeight: FontWeight.w600,
        fontFamily: fontFamily,
        letterSpacing: 0.02,
        height: 1.2,
        color: secondary,
      ),
      labelSmall: TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w500,
        fontFamily: fontFamily,
        letterSpacing: 0.2,
        height: 1.2,
        color: tertiary,
      ),
    );
  }
}
