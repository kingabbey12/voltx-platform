import 'package:flutter/material.dart';

/// Voltx color palette — Apple clarity with Linear minimal contrast.
abstract final class ColorTokens {
  // Brand
  static const Color brandPrimary = Color(0xFF3E63F4);
  static const Color brandPrimaryHover = Color(0xFF2F52DD);
  static const Color brandPrimaryPressed = Color(0xFF233FB5);
  static const Color brandSecondary = Color(0xFF0EA5A0);
  static const Color brandAccent = Color(0xFF5F8CFF);

  // Neutrals
  static const Color neutral0 = Color(0xFFFFFFFF);
  static const Color neutral50 = Color(0xFFF8FAFC);
  static const Color neutral100 = Color(0xFFF1F5F9);
  static const Color neutral200 = Color(0xFFE2E8F0);
  static const Color neutral300 = Color(0xFFCBD5E1);
  static const Color neutral400 = Color(0xFF94A3B8);
  static const Color neutral500 = Color(0xFF64748B);
  static const Color neutral600 = Color(0xFF475569);
  static const Color neutral700 = Color(0xFF334155);
  static const Color neutral800 = Color(0xFF1E293B);
  static const Color neutral900 = Color(0xFF0F172A);
  static const Color neutral950 = Color(0xFF020617);

  // Semantic — WCAG AA on neutral surfaces
  static const Color success = Color(0xFF0B8F63);
  static const Color successSurface = Color(0xFFD7F8EC);
  static const Color warning = Color(0xFFC57A10);
  static const Color warningSurface = Color(0xFFFFF3DC);
  static const Color error = Color(0xFFD0384D);
  static const Color errorSurface = Color(0xFFFFE8EE);
  static const Color info = Color(0xFF0C7FC2);
  static const Color infoSurface = Color(0xFFE6F4FF);

  // Surfaces
  static const Color surfaceLight = Color(0xFFF3F7FD);
  static const Color surfaceMutedLight = Color(0xFFEAF0FA);
  static const Color surfaceElevatedLight = Color(0xFFFFFFFF);
  static const Color surfaceDark = Color(0xFF060A14);
  static const Color surfaceMutedDark = Color(0xFF0F172A);
  static const Color surfaceElevatedDark = Color(0xFF162036);

  // Borders — Linear-inspired hairlines
  static const Color borderLight = Color(0xFFD5E1F2);
  static const Color borderStrongLight = Color(0xFFB6C6DD);
  static const Color borderDark = Color(0xFF2C3A56);
  static const Color borderStrongDark = Color(0xFF435575);

  static const Color overlayLight = Color(0x5C0B1026);
  static const Color overlayDark = Color(0xB80A1024);
}
