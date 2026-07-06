import '../../../../core/network/api_client.dart';
import '../../../../core/network/network_exception.dart';
import '../models/integration_models.dart';

class IntegrationApiService {
  IntegrationApiService(this._apiClient);

  final ApiClient _apiClient;

  Future<PaginatedIntegrationResult<IntegrationConnection>> listConnections(
    IntegrationPageQuery query,
  ) {
    return _apiClient.get(
      '/integrations/connections',
      queryParameters: query.toQueryParameters(),
      fromJson: (json) => PaginatedIntegrationResult.fromJson(json, IntegrationConnection.fromJson),
    );
  }

  Future<IntegrationConnection> getConnection(String id) {
    return _apiClient.get('/integrations/connections/$id', fromJson: IntegrationConnection.fromJson);
  }

  Future<IntegrationConnection> createApiKeyConnection({
    required String provider,
    required String displayName,
    String? apiKey,
    String? webhookSecret,
    String? externalAccountId,
  }) {
    return _apiClient.post(
      '/integrations/connections',
      data: {
        'provider': provider,
        'displayName': displayName,
        if (apiKey != null && apiKey.trim().isNotEmpty) 'apiKey': apiKey.trim(),
        if (webhookSecret != null && webhookSecret.trim().isNotEmpty) 'webhookSecret': webhookSecret.trim(),
        if (externalAccountId != null && externalAccountId.trim().isNotEmpty)
          'externalAccountId': externalAccountId.trim(),
      },
      fromJson: IntegrationConnection.fromJson,
    );
  }

  Future<Map<String, dynamic>> initiateOAuth({
    required String provider,
    required String displayName,
    required String redirectUri,
  }) {
    return _apiClient.post(
      '/integrations/connections/oauth/initiate',
      data: {'provider': provider, 'displayName': displayName, 'redirectUri': redirectUri},
      fromJson: (json) => json,
    );
  }

  Future<IntegrationConnection> updateConnection(
    String id, {
    String? displayName,
    Map<String, dynamic>? config,
  }) {
    return _apiClient.patch(
      '/integrations/connections/$id',
      data: {
        'displayName': ?displayName,
        'config': ?config,
      },
      fromJson: IntegrationConnection.fromJson,
    );
  }

  Future<void> deleteConnection(String id) {
    return _apiClient.delete('/integrations/connections/$id', fromJson: (json) => json);
  }

  Future<IntegrationConnection> revokeConnection(String id) {
    return _apiClient.post('/integrations/connections/$id/revoke', fromJson: IntegrationConnection.fromJson);
  }

  Future<IntegrationConnection> refreshToken(String id) {
    return _apiClient.post(
      '/integrations/connections/$id/refresh-token',
      fromJson: IntegrationConnection.fromJson,
    );
  }

  Future<IntegrationHealthResult> checkHealth(String id) {
    return _apiClient.post(
      '/integrations/connections/$id/health-check',
      fromJson: IntegrationHealthResult.fromJson,
    );
  }

  Future<IntegrationSyncResult> sync(String id) {
    return _apiClient.post('/integrations/connections/$id/sync', fromJson: IntegrationSyncResult.fromJson);
  }

  Future<IntegrationMetrics> getMetrics(String id) {
    return _apiClient.get('/integrations/connections/$id/metrics', fromJson: IntegrationMetrics.fromJson);
  }
}

IntegrationException mapToIntegrationException(Object error) {
  if (error is IntegrationException) {
    return error;
  }
  if (error is NetworkException) {
    return IntegrationException(
      error.statusCode == null ? friendlyNetworkFailureMessage(error) : error.message,
    );
  }
  return const IntegrationException('Unable to complete integration request.');
}

class IntegrationException implements Exception {
  const IntegrationException(this.message);

  final String message;

  @override
  String toString() => message;
}
