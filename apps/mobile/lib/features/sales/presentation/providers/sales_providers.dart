import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/network_providers.dart';
import '../../data/models/sales_models.dart';
import '../../data/repositories/sales_repository.dart';
import '../../data/services/sales_api_service.dart';

final salesApiServiceProvider = Provider<SalesApiService>((ref) {
  return SalesApiService(ref.watch(apiClientProvider));
});

final salesRepositoryProvider = Provider<SalesRepository>((ref) {
  return ApiSalesRepository(ref.watch(salesApiServiceProvider));
});

final companiesProvider = FutureProvider.family<PaginatedSalesResult<SalesCompany>, SalesPageQuery>((
  ref,
  query,
) {
  return ref.watch(salesRepositoryProvider).listCompanies(query);
});

final companyDetailProvider = FutureProvider.family<SalesCompany, String>((ref, id) {
  return ref.watch(salesRepositoryProvider).getCompany(id);
});

final contactsProvider = FutureProvider.family<PaginatedSalesResult<SalesContact>, SalesPageQuery>((
  ref,
  query,
) {
  return ref.watch(salesRepositoryProvider).listContacts(query);
});

final contactDetailProvider = FutureProvider.family<SalesContact, String>((ref, id) {
  return ref.watch(salesRepositoryProvider).getContact(id);
});

final leadsProvider = FutureProvider.family<PaginatedSalesResult<SalesLead>, SalesPageQuery>((ref, query) {
  return ref.watch(salesRepositoryProvider).listLeads(query);
});

final leadDetailProvider = FutureProvider.family<SalesLead, String>((ref, id) {
  return ref.watch(salesRepositoryProvider).getLead(id);
});

final opportunitiesProvider =
    FutureProvider.family<PaginatedSalesResult<SalesOpportunity>, SalesPageQuery>((ref, query) {
  return ref.watch(salesRepositoryProvider).listOpportunities(query);
});

final activitiesProvider =
    FutureProvider.family<PaginatedSalesResult<SalesActivity>, SalesPageQuery>((ref, query) {
  return ref.watch(salesRepositoryProvider).listActivities(query);
});

final leadSearchProvider = StateProvider<String>((ref) => '');
final leadStatusFilterProvider = StateProvider<String?>((ref) => null);
final opportunityStageFilterProvider = StateProvider<String?>((ref) => null);

class SalesCopilotState {
  const SalesCopilotState({
    this.isLoading = false,
    this.activeAction,
    this.result,
    this.errorMessage,
  });

  final bool isLoading;
  final String? activeAction;
  final SalesAiActionResult? result;
  final String? errorMessage;

  SalesCopilotState copyWith({
    bool? isLoading,
    String? activeAction,
    SalesAiActionResult? result,
    bool clearResult = false,
    String? errorMessage,
    bool clearError = false,
  }) {
    return SalesCopilotState(
      isLoading: isLoading ?? this.isLoading,
      activeAction: activeAction ?? this.activeAction,
      result: clearResult ? null : (result ?? this.result),
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

class SalesCopilotController extends StateNotifier<SalesCopilotState> {
  SalesCopilotController(this._repository) : super(const SalesCopilotState());

  final SalesRepository _repository;

  Future<void> qualifyLead(String leadId, {String? prompt}) async {
    await _run('Lead qualification', () => _repository.qualifyLead(leadId, prompt: prompt));
  }

  Future<void> draftEmail(String contactId, {String? prompt}) async {
    await _run('Email draft', () => _repository.draftEmail(contactId, prompt: prompt));
  }

  Future<void> summarizeMeeting(String activityId, {String? prompt}) async {
    await _run(
      'Meeting summary',
      () => _repository.meetingSummary(activityId, prompt: prompt),
    );
  }

  Future<void> opportunityInsights(String opportunityId, {String? prompt}) async {
    await _run(
      'Opportunity insights',
      () => _repository.opportunityInsights(opportunityId, prompt: prompt),
    );
  }

  Future<void> nextBestAction(String opportunityId, {String? prompt}) async {
    await _run(
      'Next best action',
      () => _repository.nextBestAction(opportunityId, prompt: prompt),
    );
  }

  void clear() {
    state = const SalesCopilotState();
  }

  Future<void> _run(
    String action,
    Future<SalesAiActionResult> Function() operation,
  ) async {
    state = state.copyWith(
      isLoading: true,
      activeAction: action,
      clearError: true,
    );

    try {
      final result = await operation();
      state = state.copyWith(
        isLoading: false,
        activeAction: action,
        result: result,
        clearError: true,
      );
    } catch (error) {
      state = state.copyWith(
        isLoading: false,
        activeAction: action,
        errorMessage: error.toString(),
      );
    }
  }
}

final salesCopilotControllerProvider =
    StateNotifierProvider<SalesCopilotController, SalesCopilotState>((ref) {
  return SalesCopilotController(ref.watch(salesRepositoryProvider));
});
