import 'package:flutter_test/flutter_test.dart';
import 'package:voltx_mobile/core/deep_links/deep_link_service.dart';
import 'package:voltx_mobile/router/routes.dart';

void main() {
  group('resolveDeepLinkRoute', () {
    test('invitations/accept with a token', () {
      final route = resolveDeepLinkRoute(Uri.parse('voltx://invitations/accept?token=abc123'));
      expect(route, '${AppRoutes.acceptInvitation}?token=abc123');
    });

    test('invitations/accept without a token', () {
      final route = resolveDeepLinkRoute(Uri.parse('voltx://invitations/accept'));
      expect(route, AppRoutes.acceptInvitation);
    });

    test('invitations host with an unrecognized path is ignored', () {
      final route = resolveDeepLinkRoute(Uri.parse('voltx://invitations/decline'));
      expect(route, isNull);
    });

    test('notifications', () {
      final route = resolveDeepLinkRoute(Uri.parse('voltx://notifications'));
      expect(route, AppRoutes.dashboardNotifications);
    });

    test('bare sales host goes to the sales dashboard', () {
      final route = resolveDeepLinkRoute(Uri.parse('voltx://sales'));
      expect(route, AppRoutes.salesDashboard);
    });

    test('sales/leads/:id goes to lead details', () {
      final route = resolveDeepLinkRoute(Uri.parse('voltx://sales/leads/lead-42'));
      expect(route, AppRoutes.salesLeadDetails('lead-42'));
    });

    test('sales/leads with no id goes to the pipeline list', () {
      final route = resolveDeepLinkRoute(Uri.parse('voltx://sales/leads'));
      expect(route, AppRoutes.salesPipeline);
    });

    test('sales/companies/:id goes to company details', () {
      final route = resolveDeepLinkRoute(Uri.parse('voltx://sales/companies/co-1'));
      expect(route, AppRoutes.salesCompanyDetails('co-1'));
    });

    test('sales/contacts/:id goes to contact details', () {
      final route = resolveDeepLinkRoute(Uri.parse('voltx://sales/contacts/ct-1'));
      expect(route, AppRoutes.salesContactDetails('ct-1'));
    });

    test('sales/opportunities goes to the opportunity board', () {
      final route = resolveDeepLinkRoute(Uri.parse('voltx://sales/opportunities'));
      expect(route, AppRoutes.salesOpportunityBoard);
    });

    test('unrecognized sales sub-resource falls back to the sales dashboard', () {
      final route = resolveDeepLinkRoute(Uri.parse('voltx://sales/bogus'));
      expect(route, AppRoutes.salesDashboard);
    });

    test('marketplace/:id goes to app details', () {
      final route = resolveDeepLinkRoute(Uri.parse('voltx://marketplace/app-1'));
      expect(route, AppRoutes.marketplaceAppDetails('app-1'));
    });

    test('bare marketplace host goes to the marketplace home', () {
      final route = resolveDeepLinkRoute(Uri.parse('voltx://marketplace'));
      expect(route, AppRoutes.marketplaceHome);
    });

    test('billing, security, settings, ai, dashboard hosts', () {
      expect(resolveDeepLinkRoute(Uri.parse('voltx://billing')), AppRoutes.billingHome);
      expect(resolveDeepLinkRoute(Uri.parse('voltx://security')), AppRoutes.securityHome);
      expect(resolveDeepLinkRoute(Uri.parse('voltx://settings')), AppRoutes.settings);
      expect(resolveDeepLinkRoute(Uri.parse('voltx://ai')), AppRoutes.aiHome);
      expect(resolveDeepLinkRoute(Uri.parse('voltx://dashboard')), AppRoutes.dashboard);
    });

    test('unrecognized host is ignored', () {
      final route = resolveDeepLinkRoute(Uri.parse('voltx://not-a-real-host'));
      expect(route, isNull);
    });
  });
}
