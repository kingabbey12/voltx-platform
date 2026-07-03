import 'package:flutter/material.dart';

import '../../../../theme/tokens/color_tokens.dart';
import '../../../../theme/tokens/radius_tokens.dart';

/// Voltx brand icon used on splash and welcome screens.
class AuthBrandMark extends StatelessWidget {
  const AuthBrandMark({this.size = 88, super.key});

  final double size;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: scheme.primary,
        borderRadius: BorderRadius.circular(RadiusTokens.lg),
        boxShadow: [
          BoxShadow(
            color: ColorTokens.brandPrimary.withValues(alpha: 0.28),
            blurRadius: 24,
            offset: const Offset(0, 12),
          ),
        ],
      ),
      child: Icon(Icons.bolt_rounded, color: scheme.onPrimary, size: size * 0.55),
    );
  }
}
