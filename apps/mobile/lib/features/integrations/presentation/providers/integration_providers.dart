import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/network_providers.dart';
import '../../data/models/integration_models.dart';
import '../../data/repositories/integration_repository.dart';
import '../../data/services/integration_api_service.dart';

final integrationApiServiceProvider = Provider<IntegrationApiService>((ref) {
  return IntegrationApiService(ref.watch(apiClientProvider));
});

final integrationRepositoryProvider = Provider<IntegrationRepository>((ref) {
  return ApiIntegrationRepository(ref.watch(integrationApiServiceProvider));
});

final integrationConnectionsProvider =
    FutureProvider.family<PaginatedIntegrationResult<IntegrationConnection>, IntegrationPageQuery>(
        (ref, query) {
  return ref.watch(integrationRepositoryProvider).listConnections(query);
});

final integrationConnectionDetailProvider =
    FutureProvider.family<IntegrationConnection, String>((ref, id) {
  return ref.watch(integrationRepositoryProvider).getConnection(id);
});

final integrationMetricsProvider = FutureProvider.family<IntegrationMetrics, String>((ref, id) {
  return ref.watch(integrationRepositoryProvider).getMetrics(id);
});

final integrationProviderFilterProvider = StateProvider<String?>((ref) => null);

/// Drives connect/health-check/sync/refresh/revoke/delete mutations with a
/// loading flag and error surface, invalidating the affected providers on
/// success.
class IntegrationActionState {
  const IntegrationActionState({
    this.isLoading = false,
    this.errorMessage,
    this.lastHealthResult,
    this.lastSyncResult,
  });

  final bool isLoading;
  final String? errorMessage;
  final IntegrationHealthResult? lastHealthResult;
  final IntegrationSyncResult? lastSyncResult;

  IntegrationActionState copyWith({
    bool? isLoading,
    String? errorMessage,
    IntegrationHealthResult? lastHealthResult,
    IntegrationSyncResult? lastSyncResult,
  }) {
    return IntegrationActionState(
      isLoading: isLoading ?? this.isLoading,
      errorMessage: errorMessage,
      lastHealthResult: lastHealthResult ?? this.lastHealthResult,
      lastSyncResult: lastSyncResult ?? this.lastSyncResult,
    );
  }
}

class IntegrationActionController extends StateNotifier<IntegrationActionState> {
  IntegrationActionController(this._ref) : super(const IntegrationActionState());

  final Ref _ref;

  IntegrationRepository get _repository => _ref.read(integrationRepositoryProvider);

  Future<bool> connect({
    required String provider,
    required String displayName,
    String? apiKey,
    String? webhookSecret,
  }) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      await _repository.createApiKeyConnection(
        provider: provider,
        displayName: displayName,
        apiKey: apiKey,
        webhookSecret: webhookSecret,
      );
      _ref.invalidate(integrationConnectionsProvider);
      state = state.copyWith(isLoading: false);
      return true;
    } catch (error) {
      state = state.copyWith(isLoading: false, errorMessage: error.toString());
      return false;
    }
  }

  Future<void> checkHealth(String id) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final result = await _repository.checkHealth(id);
      _ref.invalidate(integrationConnectionDetailProvider(id));
      _ref.invalidate(integrationMetricsProvider(id));
      state = state.copyWith(isLoading: false, lastHealthResult: result);
    } catch (error) {
      state = state.copyWith(isLoading: false, errorMessage: error.toString());
    }
  }

  Future<void> sync(String id) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      final result = await _repository.sync(id);
      _ref.invalidate(integrationConnectionDetailProvider(id));
      _ref.invalidate(integrationMetricsProvider(id));
      state = state.copyWith(isLoading: false, lastSyncResult: result);
    } catch (error) {
      state = state.copyWith(isLoading: false, errorMessage: error.toString());
    }
  }

  Future<void> refreshToken(String id) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      await _repository.refreshToken(id);
      _ref.invalidate(integrationConnectionDetailProvider(id));
      state = state.copyWith(isLoading: false);
    } catch (error) {
      state = state.copyWith(isLoading: false, errorMessage: error.toString());
    }
  }

  Future<void> revoke(String id) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      await _repository.revokeConnection(id);
      _ref.invalidate(integrationConnectionDetailProvider(id));
      _ref.invalidate(integrationConnectionsProvider);
      state = state.copyWith(isLoading: false);
    } catch (error) {
      state = state.copyWith(isLoading: false, errorMessage: error.toString());
    }
  }

  Future<bool> delete(String id) async {
    state = state.copyWith(isLoading: true, errorMessage: null);
    try {
      await _repository.deleteConnection(id);
      _ref.invalidate(integrationConnectionsProvider);
      state = state.copyWith(isLoading: false);
      return true;
    } catch (error) {
      state = state.copyWith(isLoading: false, errorMessage: error.toString());
      return false;
    }
  }
}

final integrationActionControllerProvider =
    StateNotifierProvider<IntegrationActionController, IntegrationActionState>((ref) {
  return IntegrationActionController(ref);
});
