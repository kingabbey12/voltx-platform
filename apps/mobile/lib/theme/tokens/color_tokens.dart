import 'package:flutter/material.dart';

/// Voltx color palette — Apple clarity with Linear minimal contrast.
abstract final class ColorTokens {
  // Brand
  static const Color brandPrimary = Color(0xFF2563EB);
  static const Color brandPrimaryHover = Color(0xFF1D4ED8);
  static const Color brandPrimaryPressed = Color(0xFF1E40AF);
  static const Color brandSecondary = Color(0xFF0EA5A4);
  static const Color brandAccent = Color(0xFF6366F1);

  // Neutrals
  static const Color neutral0 = Color(0xFFFFFFFF);
  static const Color neutral50 = Color(0xFFFAFAFA);
  static const Color neutral100 = Color(0xFFF4F4F5);
  static const Color neutral200 = Color(0xFFE4E4E7);
  static const Color neutral300 = Color(0xFFD4D4D8);
  static const Color neutral400 = Color(0xFFA1A1AA);
  static const Color neutral500 = Color(0xFF71717A);
  static const Color neutral600 = Color(0xFF52525B);
  static const Color neutral700 = Color(0xFF3F3F46);
  static const Color neutral800 = Color(0xFF27272A);
  static const Color neutral900 = Color(0xFF18181B);
  static const Color neutral950 = Color(0xFF09090B);

  // Semantic — WCAG AA on neutral surfaces
  static const Color success = Color(0xFF15803D);
  static const Color successSurface = Color(0xFFDCFCE7);
  static const Color warning = Color(0xFFB45309);
  static const Color warningSurface = Color(0xFFFEF3C7);
  static const Color error = Color(0xFFB91C1C);
  static const Color errorSurface = Color(0xFFFEE2E2);
  static const Color info = Color(0xFF0369A1);
  static const Color infoSurface = Color(0xFFE0F2FE);

  // Surfaces
  static const Color surfaceLight = Color(0xFFFFFFFF);
  static const Color surfaceMutedLight = Color(0xFFFAFAFA);
  static const Color surfaceElevatedLight = Color(0xFFFFFFFF);
  static const Color surfaceDark = Color(0xFF09090B);
  static const Color surfaceMutedDark = Color(0xFF18181B);
  static const Color surfaceElevatedDark = Color(0xFF27272A);

  // Borders — Linear-inspired hairlines
  static const Color borderLight = Color(0xFFE4E4E7);
  static const Color borderStrongLight = Color(0xFFD4D4D8);
  static const Color borderDark = Color(0xFF3F3F46);
  static const Color borderStrongDark = Color(0xFF52525B);

  static const Color overlayLight = Color(0x6609090B);
  static const Color overlayDark = Color(0x9909090B);
}
