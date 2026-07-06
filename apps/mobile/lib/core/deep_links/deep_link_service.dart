import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:go_router/go_router.dart';

import '../../router/routes.dart';

/// Routes incoming `voltx://` deep links to the matching in-app screen.
/// Currently only `voltx://invitations/accept?token=...` is handled;
/// anything else is ignored rather than crashing/navigating nowhere.
class DeepLinkService {
  DeepLinkService(this._router);

  final GoRouter _router;
  final AppLinks _appLinks = AppLinks();
  StreamSubscription<Uri>? _subscription;

  Future<void> start() async {
    final initialUri = await _appLinks.getInitialLink();
    if (initialUri != null) {
      _handle(initialUri);
    }

    _subscription = _appLinks.uriLinkStream.listen(_handle);
  }

  void dispose() {
    unawaited(_subscription?.cancel());
  }

  void _handle(Uri uri) {
    if (uri.host == 'invitations' && uri.path.startsWith('/accept')) {
      final token = uri.queryParameters['token'];
      _router.go(
        token != null
            ? '${AppRoutes.acceptInvitation}?token=${Uri.encodeQueryComponent(token)}'
            : AppRoutes.acceptInvitation,
      );
    }
  }
}
