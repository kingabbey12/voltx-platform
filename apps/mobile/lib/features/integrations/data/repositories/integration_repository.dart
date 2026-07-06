import '../models/integration_models.dart';
import '../services/integration_api_service.dart';

abstract class IntegrationRepository {
  Future<PaginatedIntegrationResult<IntegrationConnection>> listConnections(IntegrationPageQuery query);
  Future<IntegrationConnection> getConnection(String id);
  Future<IntegrationConnection> createApiKeyConnection({
    required String provider,
    required String displayName,
    String? apiKey,
    String? webhookSecret,
    String? externalAccountId,
  });
  Future<Map<String, dynamic>> initiateOAuth({
    required String provider,
    required String displayName,
    required String redirectUri,
  });
  Future<IntegrationConnection> updateConnection(String id, {String? displayName, Map<String, dynamic>? config});
  Future<void> deleteConnection(String id);
  Future<IntegrationConnection> revokeConnection(String id);
  Future<IntegrationConnection> refreshToken(String id);
  Future<IntegrationHealthResult> checkHealth(String id);
  Future<IntegrationSyncResult> sync(String id);
  Future<IntegrationMetrics> getMetrics(String id);
}

class ApiIntegrationRepository implements IntegrationRepository {
  ApiIntegrationRepository(this._api);

  final IntegrationApiService _api;

  @override
  Future<PaginatedIntegrationResult<IntegrationConnection>> listConnections(
    IntegrationPageQuery query,
  ) async {
    try {
      return await _api.listConnections(query);
    } catch (error) {
      throw mapToIntegrationException(error);
    }
  }

  @override
  Future<IntegrationConnection> getConnection(String id) async {
    try {
      return await _api.getConnection(id);
    } catch (error) {
      throw mapToIntegrationException(error);
    }
  }

  @override
  Future<IntegrationConnection> createApiKeyConnection({
    required String provider,
    required String displayName,
    String? apiKey,
    String? webhookSecret,
    String? externalAccountId,
  }) async {
    try {
      return await _api.createApiKeyConnection(
        provider: provider,
        displayName: displayName,
        apiKey: apiKey,
        webhookSecret: webhookSecret,
        externalAccountId: externalAccountId,
      );
    } catch (error) {
      throw mapToIntegrationException(error);
    }
  }

  @override
  Future<Map<String, dynamic>> initiateOAuth({
    required String provider,
    required String displayName,
    required String redirectUri,
  }) async {
    try {
      return await _api.initiateOAuth(provider: provider, displayName: displayName, redirectUri: redirectUri);
    } catch (error) {
      throw mapToIntegrationException(error);
    }
  }

  @override
  Future<IntegrationConnection> updateConnection(
    String id, {
    String? displayName,
    Map<String, dynamic>? config,
  }) async {
    try {
      return await _api.updateConnection(id, displayName: displayName, config: config);
    } catch (error) {
      throw mapToIntegrationException(error);
    }
  }

  @override
  Future<void> deleteConnection(String id) async {
    try {
      await _api.deleteConnection(id);
    } catch (error) {
      throw mapToIntegrationException(error);
    }
  }

  @override
  Future<IntegrationConnection> revokeConnection(String id) async {
    try {
      return await _api.revokeConnection(id);
    } catch (error) {
      throw mapToIntegrationException(error);
    }
  }

  @override
  Future<IntegrationConnection> refreshToken(String id) async {
    try {
      return await _api.refreshToken(id);
    } catch (error) {
      throw mapToIntegrationException(error);
    }
  }

  @override
  Future<IntegrationHealthResult> checkHealth(String id) async {
    try {
      return await _api.checkHealth(id);
    } catch (error) {
      throw mapToIntegrationException(error);
    }
  }

  @override
  Future<IntegrationSyncResult> sync(String id) async {
    try {
      return await _api.sync(id);
    } catch (error) {
      throw mapToIntegrationException(error);
    }
  }

  @override
  Future<IntegrationMetrics> getMetrics(String id) async {
    try {
      return await _api.getMetrics(id);
    } catch (error) {
      throw mapToIntegrationException(error);
    }
  }
}
