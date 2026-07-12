import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/network_providers.dart';
import '../../data/models/billing_models.dart';
import '../../data/repositories/billing_repository.dart';
import '../../data/services/billing_api_service.dart';

final billingApiServiceProvider = Provider<BillingApiService>((ref) {
  return BillingApiService(ref.watch(apiClientProvider));
});

final billingRepositoryProvider = Provider<BillingRepository>((ref) {
  return ApiBillingRepository(ref.watch(billingApiServiceProvider));
});

final billingPlansProvider = FutureProvider<List<BillingPlan>>((ref) {
  return ref.watch(billingRepositoryProvider).listPlans();
});

final billingSubscriptionProvider = FutureProvider<BillingSubscription>((ref) {
  return ref.watch(billingRepositoryProvider).getSubscription();
});

final billingUsageProvider = FutureProvider<List<BillingFeatureUsage>>((ref) {
  return ref.watch(billingRepositoryProvider).getUsage();
});

final billingInvoicesPageProvider = StateProvider<int>((ref) => 1);

final billingInvoicesProvider =
    FutureProvider.family<PaginatedBillingResult<BillingInvoice>, int>((ref, page) {
  return ref.watch(billingRepositoryProvider).listInvoices(page: page, limit: 20);
});

final billingPaymentMethodsProvider = FutureProvider<List<BillingPaymentMethod>>((ref) {
  return ref.watch(billingRepositoryProvider).listPaymentMethods();
});

/// Drives every billing mutation (checkout/portal/upgrade/downgrade/
/// cancel/resume/payment-method actions) with a loading flag and error
/// surface, invalidating the affected providers on success — same shape
/// as WorkflowActionController.
class BillingActionState {
  const BillingActionState({this.isLoading = false, this.errorMessage});

  final bool isLoading;
  final String? errorMessage;

  BillingActionState copyWith({bool? isLoading, String? errorMessage}) {
    return BillingActionState(
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage,
    );
  }
}

class BillingActionController extends StateNotifier<BillingActionState> {
  BillingActionController(this._ref) : super(const BillingActionState());

  final Ref _ref;

  BillingRepository get _repository => _ref.read(billingRepositoryProvider);

  Future<BillingHostedSession?> createCheckoutSession({
    required String planKey,
    required int seats,
    required String successUrl,
    required String cancelUrl,
  }) {
    return _wrap(
      () => _repository.createCheckoutSession(
        planKey: planKey,
        seats: seats,
        successUrl: successUrl,
        cancelUrl: cancelUrl,
      ),
    );
  }

  Future<BillingHostedSession?> createPortalSession({required String returnUrl}) {
    return _wrap(() => _repository.createPortalSession(returnUrl: returnUrl));
  }

  Future<void> upgrade(String planKey, {int seats = 1}) => _wrapAndRefresh(
        () => _repository.upgradeSubscription(planKey, seats: seats),
      );

  Future<void> downgrade(String planKey, {int seats = 1}) => _wrapAndRefresh(
        () => _repository.downgradeSubscription(planKey, seats: seats),
      );

  Future<void> cancel({bool atPeriodEnd = true}) => _wrapAndRefresh(
        () => _repository.cancelSubscription(atPeriodEnd: atPeriodEnd),
      );

  Future<void> resume() => _wrapAndRefresh(() => _repository.resumeSubscription());

  Future<void> setDefaultPaymentMethod(String id) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      await _repository.setDefaultPaymentMethod(id);
      _ref.invalidate(billingPaymentMethodsProvider);
      state = state.copyWith(isLoading: false);
    } catch (error) {
      state = state.copyWith(isLoading: false, errorMessage: error.toString());
    }
  }

  Future<void> removePaymentMethod(String id) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      await _repository.removePaymentMethod(id);
      _ref.invalidate(billingPaymentMethodsProvider);
      state = state.copyWith(isLoading: false);
    } catch (error) {
      state = state.copyWith(isLoading: false, errorMessage: error.toString());
    }
  }

  Future<T?> _wrap<T>(Future<T> Function() action) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final result = await action();
      state = state.copyWith(isLoading: false);
      return result;
    } catch (error) {
      state = state.copyWith(isLoading: false, errorMessage: error.toString());
      return null;
    }
  }

  Future<void> _wrapAndRefresh(Future<void> Function() action) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      await action();
      _ref.invalidate(billingSubscriptionProvider);
      _ref.invalidate(billingUsageProvider);
      state = state.copyWith(isLoading: false);
    } catch (error) {
      state = state.copyWith(isLoading: false, errorMessage: error.toString());
    }
  }

  void clearError() => state = state.copyWith(errorMessage: null);
}

final billingActionControllerProvider =
    StateNotifierProvider<BillingActionController, BillingActionState>((ref) {
  return BillingActionController(ref);
});
