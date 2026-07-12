import '../models/billing_models.dart';
import '../services/billing_api_service.dart';

abstract class BillingRepository {
  Future<List<BillingPlan>> listPlans();
  Future<BillingPlan> getPlan(String key);
  Future<BillingSubscription> getSubscription();
  Future<BillingSubscription> upgradeSubscription(String planKey, {int seats = 1});
  Future<BillingSubscription> downgradeSubscription(String planKey, {int seats = 1});
  Future<BillingSubscription> cancelSubscription({bool atPeriodEnd = true});
  Future<BillingSubscription> resumeSubscription();
  Future<List<BillingFeatureUsage>> getUsage();
  Future<BillingHostedSession> createCheckoutSession({
    required String planKey,
    required int seats,
    required String successUrl,
    required String cancelUrl,
  });
  Future<BillingHostedSession> createPortalSession({required String returnUrl});
  Future<PaginatedBillingResult<BillingInvoice>> listInvoices({int page = 1, int limit = 20});
  Future<List<BillingPaymentMethod>> listPaymentMethods();
  Future<BillingPaymentMethod> setDefaultPaymentMethod(String id);
  Future<void> removePaymentMethod(String id);
}

class ApiBillingRepository implements BillingRepository {
  ApiBillingRepository(this._api);

  final BillingApiService _api;

  @override
  Future<List<BillingPlan>> listPlans() async {
    try {
      return await _api.listPlans();
    } catch (error) {
      throw mapToBillingException(error);
    }
  }

  @override
  Future<BillingPlan> getPlan(String key) async {
    try {
      return await _api.getPlan(key);
    } catch (error) {
      throw mapToBillingException(error);
    }
  }

  @override
  Future<BillingSubscription> getSubscription() async {
    try {
      return await _api.getSubscription();
    } catch (error) {
      throw mapToBillingException(error);
    }
  }

  @override
  Future<BillingSubscription> upgradeSubscription(String planKey, {int seats = 1}) async {
    try {
      return await _api.upgradeSubscription(planKey, seats: seats);
    } catch (error) {
      throw mapToBillingException(error);
    }
  }

  @override
  Future<BillingSubscription> downgradeSubscription(String planKey, {int seats = 1}) async {
    try {
      return await _api.downgradeSubscription(planKey, seats: seats);
    } catch (error) {
      throw mapToBillingException(error);
    }
  }

  @override
  Future<BillingSubscription> cancelSubscription({bool atPeriodEnd = true}) async {
    try {
      return await _api.cancelSubscription(atPeriodEnd: atPeriodEnd);
    } catch (error) {
      throw mapToBillingException(error);
    }
  }

  @override
  Future<BillingSubscription> resumeSubscription() async {
    try {
      return await _api.resumeSubscription();
    } catch (error) {
      throw mapToBillingException(error);
    }
  }

  @override
  Future<List<BillingFeatureUsage>> getUsage() async {
    try {
      return await _api.getUsage();
    } catch (error) {
      throw mapToBillingException(error);
    }
  }

  @override
  Future<BillingHostedSession> createCheckoutSession({
    required String planKey,
    required int seats,
    required String successUrl,
    required String cancelUrl,
  }) async {
    try {
      return await _api.createCheckoutSession(
        planKey: planKey,
        seats: seats,
        successUrl: successUrl,
        cancelUrl: cancelUrl,
      );
    } catch (error) {
      throw mapToBillingException(error);
    }
  }

  @override
  Future<BillingHostedSession> createPortalSession({required String returnUrl}) async {
    try {
      return await _api.createPortalSession(returnUrl: returnUrl);
    } catch (error) {
      throw mapToBillingException(error);
    }
  }

  @override
  Future<PaginatedBillingResult<BillingInvoice>> listInvoices({int page = 1, int limit = 20}) async {
    try {
      return await _api.listInvoices(page: page, limit: limit);
    } catch (error) {
      throw mapToBillingException(error);
    }
  }

  @override
  Future<List<BillingPaymentMethod>> listPaymentMethods() async {
    try {
      return await _api.listPaymentMethods();
    } catch (error) {
      throw mapToBillingException(error);
    }
  }

  @override
  Future<BillingPaymentMethod> setDefaultPaymentMethod(String id) async {
    try {
      return await _api.setDefaultPaymentMethod(id);
    } catch (error) {
      throw mapToBillingException(error);
    }
  }

  @override
  Future<void> removePaymentMethod(String id) async {
    try {
      await _api.removePaymentMethod(id);
    } catch (error) {
      throw mapToBillingException(error);
    }
  }
}
