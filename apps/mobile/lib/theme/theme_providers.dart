import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app_theme.dart';

/// The app's single black & gold theme — no light-mode palette is
/// designed, so there is no themeModeProvider/lightThemeProvider to pick
/// between (see VoltxApp, which always sets `themeMode: ThemeMode.dark`).
final darkThemeProvider = Provider<ThemeData>((ref) => AppTheme.dark());
