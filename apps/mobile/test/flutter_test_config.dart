import 'dart:async';
import 'dart:ui';

import 'package:google_fonts/google_fonts.dart';

/// Flutter's test runner auto-loads this file for every test under this
/// directory. `google_fonts` fetches font files over the network at
/// runtime by default — fine in a real app (fonts.gstatic.com is
/// reachable), but the sandboxed `flutter test` environment has no
/// network access, and (with runtime fetching disabled) the package
/// still `rethrow`s inside a fire-and-forget Future when a font isn't
/// pre-bundled as a test asset (see google_fonts_base.dart's
/// `loadFontIfNecessary`). That unhandled Future error surfaces later,
/// against whichever test happens to be running at that moment, rather
/// than failing the widget build itself (which already falls back to
/// the platform default font synchronously). `PlatformDispatcher.onError`
/// is the hook `TestWidgetsFlutterBinding` itself checks for "did this
/// error go unhandled" — returning `true` marks it handled so it never
/// fails a test. This does not suppress errors raised by the tests' own
/// assertions or app logic, only this specific, known, test-environment
/// -only font-fetch limitation.
Future<void> testExecutable(FutureOr<void> Function() testMain) async {
  GoogleFonts.config.allowRuntimeFetching = false;

  PlatformDispatcher.instance.onError = (error, stack) {
    final message = error.toString();
    return message.contains('allowRuntimeFetching is false but font') ||
        message.contains('Failed to load font with url');
  };

  await testMain();
}
