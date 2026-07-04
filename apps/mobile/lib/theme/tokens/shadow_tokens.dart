import 'package:flutter/material.dart';

import 'color_tokens.dart';

/// Elevation shadows tuned for light and dark surfaces.
abstract final class ShadowTokens {
  static List<BoxShadow> cardLight = [
    BoxShadow(
      color: ColorTokens.brandAccent.withValues(alpha: 0.08),
      blurRadius: 20,
      spreadRadius: -14,
      offset: const Offset(0, 8),
    ),
    BoxShadow(
      color: ColorTokens.neutral900.withValues(alpha: 0.09),
      blurRadius: 28,
      spreadRadius: -16,
      offset: const Offset(0, 14),
    ),
  ];

  static List<BoxShadow> cardDark = [
    BoxShadow(
      color: ColorTokens.brandAccent.withValues(alpha: 0.16),
      blurRadius: 20,
      spreadRadius: -12,
      offset: const Offset(0, 8),
    ),
    BoxShadow(
      color: Colors.black.withValues(alpha: 0.5),
      blurRadius: 30,
      spreadRadius: -18,
      offset: const Offset(0, 16),
    ),
  ];

  static List<BoxShadow> dropdownLight = [
    BoxShadow(
      color: ColorTokens.neutral900.withValues(alpha: 0.12),
      blurRadius: 26,
      spreadRadius: -12,
      offset: const Offset(0, 12),
    ),
  ];

  static List<BoxShadow> dropdownDark = [
    BoxShadow(
      color: Colors.black.withValues(alpha: 0.58),
      blurRadius: 28,
      spreadRadius: -10,
      offset: const Offset(0, 14),
    ),
  ];

  static List<BoxShadow> modalLight = [
    BoxShadow(
      color: ColorTokens.brandAccent.withValues(alpha: 0.1),
      blurRadius: 34,
      spreadRadius: -12,
      offset: const Offset(0, 12),
    ),
    BoxShadow(
      color: ColorTokens.neutral900.withValues(alpha: 0.16),
      blurRadius: 40,
      spreadRadius: -16,
      offset: const Offset(0, 20),
    ),
  ];

  static List<BoxShadow> modalDark = [
    BoxShadow(
      color: ColorTokens.brandAccent.withValues(alpha: 0.18),
      blurRadius: 32,
      spreadRadius: -10,
      offset: const Offset(0, 14),
    ),
    BoxShadow(
      color: Colors.black.withValues(alpha: 0.62),
      blurRadius: 44,
      spreadRadius: -14,
      offset: const Offset(0, 22),
    ),
  ];
}
