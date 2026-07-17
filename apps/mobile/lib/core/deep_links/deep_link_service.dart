import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:go_router/go_router.dart';

import '../../router/routes.dart';

/// Routes incoming `voltx://` deep links to the matching in-app screen,
/// dispatching on `uri.host` (see AndroidManifest.xml's intent-filter,
/// which deliberately has no `android:host` restriction so every host
/// below reaches this handler — iOS never restricted by host to begin
/// with). Unrecognized hosts/paths are ignored rather than crashing or
/// navigating nowhere.
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
    final route = resolveDeepLinkRoute(uri);
    if (route != null) {
      _router.go(route);
    }
  }
}

/// Pure `Uri -> route path` resolution, kept separate from [DeepLinkService]
/// so it's testable without mocking `AppLinks`/`GoRouter`. Returns null for
/// any host/path this app doesn't recognize.
String? resolveDeepLinkRoute(Uri uri) {
  final segments = uri.pathSegments;

  switch (uri.host) {
    case 'invitations':
      if (!uri.path.startsWith('/accept')) {
        return null;
      }
      final token = uri.queryParameters['token'];
      return token != null
          ? '${AppRoutes.acceptInvitation}?token=${Uri.encodeQueryComponent(token)}'
          : AppRoutes.acceptInvitation;
    case 'notifications':
      return AppRoutes.dashboardNotifications;
    case 'sales':
      return _resolveSalesRoute(segments);
    case 'marketplace':
      return segments.isNotEmpty
          ? AppRoutes.marketplaceAppDetails(segments.first)
          : AppRoutes.marketplaceHome;
    case 'billing':
      return AppRoutes.billingHome;
    case 'security':
      return AppRoutes.securityHome;
    case 'settings':
      return AppRoutes.settings;
    case 'ai':
      return AppRoutes.aiHome;
    case 'dashboard':
      return AppRoutes.dashboard;
    default:
      return null;
  }
}

String _resolveSalesRoute(List<String> segments) {
  if (segments.isEmpty) {
    return AppRoutes.salesDashboard;
  }

  final resource = segments.first;
  final id = segments.length > 1 ? segments[1] : null;

  switch (resource) {
    case 'leads':
      return id != null ? AppRoutes.salesLeadDetails(id) : AppRoutes.salesPipeline;
    case 'companies':
      return id != null ? AppRoutes.salesCompanyDetails(id) : AppRoutes.salesCompanies;
    case 'contacts':
      return id != null ? AppRoutes.salesContactDetails(id) : AppRoutes.salesContacts;
    case 'opportunities':
      return AppRoutes.salesOpportunityBoard;
    default:
      return AppRoutes.salesDashboard;
  }
}
