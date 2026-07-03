import 'package:flutter/material.dart';

import '../tokens/shadow_tokens.dart';

@immutable
class VoltxShadowsExtension extends ThemeExtension<VoltxShadowsExtension> {
  const VoltxShadowsExtension({
    required this.card,
    required this.dropdown,
    required this.modal,
  });

  static final VoltxShadowsExtension light = VoltxShadowsExtension(
    card: ShadowTokens.cardLight,
    dropdown: ShadowTokens.dropdownLight,
    modal: ShadowTokens.modalLight,
  );

  static final VoltxShadowsExtension dark = VoltxShadowsExtension(
    card: ShadowTokens.cardDark,
    dropdown: ShadowTokens.dropdownDark,
    modal: ShadowTokens.modalDark,
  );

  final List<BoxShadow> card;
  final List<BoxShadow> dropdown;
  final List<BoxShadow> modal;

  @override
  VoltxShadowsExtension copyWith({
    List<BoxShadow>? card,
    List<BoxShadow>? dropdown,
    List<BoxShadow>? modal,
  }) {
    return VoltxShadowsExtension(
      card: card ?? this.card,
      dropdown: dropdown ?? this.dropdown,
      modal: modal ?? this.modal,
    );
  }

  @override
  VoltxShadowsExtension lerp(
    ThemeExtension<VoltxShadowsExtension>? other,
    double t,
  ) {
    if (other is! VoltxShadowsExtension) {
      return this;
    }
    return t < 0.5 ? this : other;
  }
}
