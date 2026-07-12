import '../../../../core/network/api_client.dart';
import '../../../../core/network/network_exception.dart';
import '../models/billing_models.dart';

class BillingApiService {
  BillingApiService(this._apiClient);

  final ApiClient _apiClient;

  Future<List<BillingPlan>> listPlans() {
    return _apiClient.getListPlain('/billing/plans', fromJson: BillingPlan.fromJson);
  }

  Future<BillingPlan> getPlan(String key) {
    return _apiClient.get('/billing/plans/$key', fromJson: BillingPlan.fromJson);
  }

  Future<BillingSubscription> getSubscription() {
    return _apiClient.get('/billing/subscription', fromJson: BillingSubscription.fromJson);
  }

  Future<BillingSubscription> upgradeSubscription(String planKey, {int seats = 1}) {
    return _apiClient.post(
      '/billing/subscription/upgrade',
      data: {'planKey': planKey, 'seats': seats},
      fromJson: BillingSubscription.fromJson,
    );
  }

  Future<BillingSubscription> downgradeSubscription(String planKey, {int seats = 1}) {
    return _apiClient.post(
      '/billing/subscription/downgrade',
      data: {'planKey': planKey, 'seats': seats},
      fromJson: BillingSubscription.fromJson,
    );
  }

  Future<BillingSubscription> cancelSubscription({bool atPeriodEnd = true}) {
    return _apiClient.post(
      '/billing/subscription/cancel',
      data: {'atPeriodEnd': atPeriodEnd},
      fromJson: BillingSubscription.fromJson,
    );
  }

  Future<BillingSubscription> resumeSubscription() {
    return _apiClient.post('/billing/subscription/resume', fromJson: BillingSubscription.fromJson);
  }

  Future<List<BillingFeatureUsage>> getUsage() {
    return _apiClient.getListPlain('/billing/usage', fromJson: BillingFeatureUsage.fromJson);
  }

  Future<BillingHostedSession> createCheckoutSession({
    required String planKey,
    required int seats,
    required String successUrl,
    required String cancelUrl,
  }) {
    return _apiClient.post(
      '/billing/checkout',
      data: {
        'planKey': planKey,
        'seats': seats,
        'successUrl': successUrl,
        'cancelUrl': cancelUrl,
      },
      fromJson: BillingHostedSession.fromJson,
    );
  }

  Future<BillingHostedSession> createPortalSession({required String returnUrl}) {
    return _apiClient.post(
      '/billing/portal',
      data: {'returnUrl': returnUrl},
      fromJson: BillingHostedSession.fromJson,
    );
  }

  Future<PaginatedBillingResult<BillingInvoice>> listInvoices({int page = 1, int limit = 20}) {
    return _apiClient.get(
      '/billing/invoices',
      queryParameters: {'page': page, 'limit': limit},
      fromJson: (json) => PaginatedBillingResult.fromJson(json, BillingInvoice.fromJson),
    );
  }

  Future<List<BillingPaymentMethod>> listPaymentMethods() {
    return _apiClient.getListPlain(
      '/billing/payment-methods',
      fromJson: BillingPaymentMethod.fromJson,
    );
  }

  Future<BillingPaymentMethod> setDefaultPaymentMethod(String id) {
    return _apiClient.post(
      '/billing/payment-methods/$id/default',
      fromJson: BillingPaymentMethod.fromJson,
    );
  }

  Future<void> removePaymentMethod(String id) async {
    await _apiClient.delete<bool>(
      '/billing/payment-methods/$id',
      fromJson: (json) => json['removed'] as bool? ?? true,
    );
  }
}

BillingException mapToBillingException(Object error) {
  if (error is BillingException) return error;
  if (error is NetworkException) {
    return BillingException(
      error.statusCode == null ? friendlyNetworkFailureMessage(error) : error.message,
    );
  }
  return const BillingException('Unable to complete billing request.');
}

class BillingException implements Exception {
  const BillingException(this.message);
  final String message;
  @override
  String toString() => message;
}
