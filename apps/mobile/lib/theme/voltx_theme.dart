import 'package:flutter/material.dart';

import 'extensions/voltx_colors_extension.dart';
import 'extensions/voltx_motion_extension.dart';
import 'extensions/voltx_radii_extension.dart';
import 'extensions/voltx_shadows_extension.dart';

/// Convenient access to Voltx [ThemeExtension] tokens from [BuildContext].
extension VoltxThemeX on BuildContext {
  ThemeData get voltxTheme => Theme.of(this);

  VoltxColorsExtension get voltxColors =>
      voltxTheme.extension<VoltxColorsExtension>()!;

  VoltxRadiiExtension get voltxRadii =>
      voltxTheme.extension<VoltxRadiiExtension>()!;

  VoltxShadowsExtension get voltxShadows =>
      voltxTheme.extension<VoltxShadowsExtension>()!;

  VoltxMotionExtension get voltxMotion =>
      voltxTheme.extension<VoltxMotionExtension>()!;
}
