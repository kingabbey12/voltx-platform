import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:voltx_mobile/features/billing/data/models/billing_models.dart';
import 'package:voltx_mobile/features/billing/data/repositories/billing_repository.dart';
import 'package:voltx_mobile/features/billing/presentation/providers/billing_providers.dart';
import 'package:voltx_mobile/features/billing/presentation/screens/billing_dashboard_screen.dart';
import 'package:voltx_mobile/router/routes.dart';
import 'package:voltx_mobile/theme/app_theme.dart';

class _FakeBillingRepository implements BillingRepository {
  _FakeBillingRepository({
    this.plans = const [],
    required this.subscription,
    this.usage = const [],
  });

  final List<BillingPlan> plans;
  final BillingSubscription subscription;
  final List<BillingFeatureUsage> usage;
  String? lastResumeCalled;

  @override
  Future<List<BillingPlan>> listPlans() async => plans;

  @override
  Future<BillingPlan> getPlan(String key) => throw UnimplementedError();

  @override
  Future<BillingSubscription> getSubscription() async => subscription;

  @override
  Future<BillingSubscription> upgradeSubscription(String planKey, {int seats = 1}) =>
      throw UnimplementedError();

  @override
  Future<BillingSubscription> downgradeSubscription(String planKey, {int seats = 1}) =>
      throw UnimplementedError();

  @override
  Future<BillingSubscription> cancelSubscription({bool atPeriodEnd = true}) =>
      throw UnimplementedError();

  @override
  Future<BillingSubscription> resumeSubscription() async {
    lastResumeCalled = 'resumed';
    return subscription;
  }

  @override
  Future<List<BillingFeatureUsage>> getUsage() async => usage;

  @override
  Future<BillingHostedSession> createCheckoutSession({
    required String planKey,
    required int seats,
    required String successUrl,
    required String cancelUrl,
  }) =>
      throw UnimplementedError();

  @override
  Future<BillingHostedSession> createPortalSession({required String returnUrl}) =>
      throw UnimplementedError();

  @override
  Future<PaginatedBillingResult<BillingInvoice>> listInvoices({int page = 1, int limit = 20}) =>
      throw UnimplementedError();

  @override
  Future<List<BillingPaymentMethod>> listPaymentMethods() => throw UnimplementedError();

  @override
  Future<BillingPaymentMethod> setDefaultPaymentMethod(String id) => throw UnimplementedError();

  @override
  Future<void> removePaymentMethod(String id) => throw UnimplementedError();
}

Widget _wrap(Widget child, {required List<Override> overrides}) {
  final router = GoRouter(
    initialLocation: AppRoutes.billingHome,
    routes: [
      GoRoute(
        path: AppRoutes.billingHome,
        builder: (context, state) => Scaffold(body: child),
      ),
    ],
  );

  return ProviderScope(
    overrides: overrides,
    child: MaterialApp.router(
      theme: AppTheme.light(),
      routerConfig: router,
    ),
  );
}

void main() {
  group('BillingDashboardScreen', () {
    testWidgets('renders the current plan, status, and usage rows', (tester) async {
      final repository = _FakeBillingRepository(
        plans: const [
          BillingPlan(
            id: 'plan-1',
            key: 'professional',
            name: 'Professional',
            sortOrder: 2,
            trialDays: 14,
            priceMonthlyUsd: 99,
          ),
        ],
        subscription: const BillingSubscription(
          id: 'sub-1',
          planId: 'plan-1',
          status: 'TRIALING',
          seats: 1,
          currentPeriodStart: '2026-01-01T00:00:00.000Z',
          currentPeriodEnd: '2026-01-15T00:00:00.000Z',
          trialEnd: '2026-01-15T00:00:00.000Z',
          cancelAtPeriodEnd: false,
        ),
        usage: const [
          BillingFeatureUsage(
            featureKey: 'ai_requests',
            currentUsage: 10,
            limit: 100,
            remaining: 90,
            unit: 'COUNT',
          ),
        ],
      );

      await tester.pumpWidget(
        _wrap(
          const BillingDashboardScreen(),
          overrides: [billingRepositoryProvider.overrideWithValue(repository)],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Professional'), findsOneWidget);
      expect(find.text('TRIALING'), findsOneWidget);
      expect(find.textContaining('AI requests'), findsOneWidget);
    });

    testWidgets('shows a resume button and resumes when cancelAtPeriodEnd is true', (tester) async {
      final repository = _FakeBillingRepository(
        subscription: const BillingSubscription(
          id: 'sub-1',
          planId: 'plan-1',
          status: 'ACTIVE',
          seats: 1,
          currentPeriodStart: '2026-01-01T00:00:00.000Z',
          currentPeriodEnd: '2026-02-01T00:00:00.000Z',
          cancelAtPeriodEnd: true,
        ),
      );

      await tester.pumpWidget(
        _wrap(
          const BillingDashboardScreen(),
          overrides: [billingRepositoryProvider.overrideWithValue(repository)],
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Resume subscription'), findsOneWidget);

      await tester.tap(find.text('Resume subscription'));
      await tester.pumpAndSettle();

      expect(repository.lastResumeCalled, 'resumed');
    });
  });
}
