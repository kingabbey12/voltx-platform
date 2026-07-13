/// Border radius tokens for Voltx surfaces and controls.
abstract final class RadiusTokens {
  static const double none = 0;
  static const double xs = 8;
  static const double sm = 10;
  static const double md = 14;
  static const double lg = 18;
  static const double xl = 24;
  static const double xxl = 30;
  static const double full = 999;

  /// Cards specifically render at 20px per the design system spec —
  /// bigger than [md] (buttons/inputs, 14px) but its own step, not [lg]
  /// (18px) or [xl] (24px).
  static const double card = 20;
}
