import 'package:flutter/material.dart';

import '../tokens/icon_tokens.dart';
import '../voltx_theme.dart';

/// Consistent icon sizing across the Voltx design system.
class VoltxIcon extends StatelessWidget {
  const VoltxIcon(
    this.icon, {
    this.size = IconTokens.md,
    this.color,
    super.key,
  });

  const VoltxIcon.sm(
    this.icon, {
    this.color,
    super.key,
  }) : size = IconTokens.sm;

  const VoltxIcon.lg(
    this.icon, {
    this.color,
    super.key,
  }) : size = IconTokens.lg;

  final IconData icon;
  final double size;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Icon(
      icon,
      size: size,
      color: color ?? context.voltxColors.textSecondary,
    );
  }
}
