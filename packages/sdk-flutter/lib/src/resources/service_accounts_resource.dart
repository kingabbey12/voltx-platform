import '../models/service_account.dart';
import '../voltx_client.dart';

class ServiceAccountsResource {
  ServiceAccountsResource(this._client);
  final VoltxClient _client;

  Future<List<ServiceAccount>> list(String organizationId) => _client.requestList(
        '/organizations/$organizationId/service-accounts',
        fromJson: ServiceAccount.fromJson,
      );

  Future<ServiceAccount> create(
    String organizationId, {
    required String name,
    required String roleId,
    String? description,
  }) =>
      _client.request(
        '/organizations/$organizationId/service-accounts',
        method: 'POST',
        body: {
          'name': name,
          'roleId': roleId,
          if (description != null) 'description': description,
        },
        fromJson: ServiceAccount.fromJson,
      );

  Future<ServiceAccount> get(String organizationId, String id) => _client.request(
        '/organizations/$organizationId/service-accounts/$id',
        fromJson: ServiceAccount.fromJson,
      );

  Future<ServiceAccount> suspend(String organizationId, String id) => _client.request(
        '/organizations/$organizationId/service-accounts/$id/suspend',
        method: 'POST',
        fromJson: ServiceAccount.fromJson,
      );

  Future<ServiceAccount> reactivate(String organizationId, String id) => _client.request(
        '/organizations/$organizationId/service-accounts/$id/reactivate',
        method: 'POST',
        fromJson: ServiceAccount.fromJson,
      );

  Future<List<ServiceAccountToken>> listTokens(String organizationId, String id) => _client.requestList(
        '/organizations/$organizationId/service-accounts/$id/tokens',
        fromJson: ServiceAccountToken.fromJson,
      );

  Future<CreateServiceAccountTokenResult> createToken(
    String organizationId,
    String id, {
    required String name,
    String? expiresAt,
  }) =>
      _client.request(
        '/organizations/$organizationId/service-accounts/$id/tokens',
        method: 'POST',
        body: {'name': name, if (expiresAt != null) 'expiresAt': expiresAt},
        fromJson: CreateServiceAccountTokenResult.fromJson,
      );

  Future<void> revokeToken(String organizationId, String id, String tokenId) => _client.requestVoid(
        '/organizations/$organizationId/service-accounts/$id/tokens/$tokenId',
      );
}
