import 'package:flutter/material.dart';

import 'color_tokens.dart';

/// Elevation shadows tuned for light and dark surfaces.
abstract final class ShadowTokens {
  static List<BoxShadow> cardLight = [
    BoxShadow(
      color: ColorTokens.neutral900.withValues(alpha: 0.04),
      blurRadius: 8,
      offset: const Offset(0, 2),
    ),
    BoxShadow(
      color: ColorTokens.neutral900.withValues(alpha: 0.02),
      blurRadius: 24,
      offset: const Offset(0, 8),
    ),
  ];

  static List<BoxShadow> cardDark = [
    BoxShadow(
      color: Colors.black.withValues(alpha: 0.32),
      blurRadius: 12,
      offset: const Offset(0, 4),
    ),
  ];

  static List<BoxShadow> dropdownLight = [
    BoxShadow(
      color: ColorTokens.neutral900.withValues(alpha: 0.08),
      blurRadius: 16,
      offset: const Offset(0, 8),
    ),
  ];

  static List<BoxShadow> dropdownDark = [
    BoxShadow(
      color: Colors.black.withValues(alpha: 0.48),
      blurRadius: 20,
      offset: const Offset(0, 10),
    ),
  ];

  static List<BoxShadow> modalLight = [
    BoxShadow(
      color: ColorTokens.neutral900.withValues(alpha: 0.12),
      blurRadius: 32,
      offset: const Offset(0, 16),
    ),
  ];

  static List<BoxShadow> modalDark = [
    BoxShadow(
      color: Colors.black.withValues(alpha: 0.56),
      blurRadius: 40,
      offset: const Offset(0, 20),
    ),
  ];
}
