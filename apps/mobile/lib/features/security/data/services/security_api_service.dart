import '../../../../core/network/api_client.dart';
import '../../../../core/network/network_exception.dart';
import '../models/security_models.dart';

class SecurityApiService {
  SecurityApiService(this._apiClient);

  final ApiClient _apiClient;

  Future<SecurityPolicy> getPolicy(String organizationId) {
    return _apiClient.get(
      '/organizations/$organizationId/security-policy',
      fromJson: SecurityPolicy.fromJson,
    );
  }

  Future<SecurityPolicy> updatePolicy(
    String organizationId, {
    bool? mfaRequired,
    PasswordPolicy? passwordPolicy,
    List<String>? ipAllowlist,
  }) {
    return _apiClient.patch(
      '/organizations/$organizationId/security-policy',
      data: {
        'mfaRequired': ?mfaRequired,
        'passwordPolicy': ?passwordPolicy?.toJson(),
        'ipAllowlist': ?ipAllowlist,
      },
      fromJson: SecurityPolicy.fromJson,
    );
  }

  Future<List<Session>> listSessions() {
    return _apiClient.getListPlain('/security/sessions', fromJson: Session.fromJson);
  }

  Future<void> revokeSession(String id) {
    return _apiClient.delete('/security/sessions/$id', fromJson: (json) => json);
  }

  Future<PaginatedSessions> loginHistory({int page = 1, int limit = 20}) {
    return _apiClient.get(
      '/security/login-history',
      queryParameters: {'page': page, 'limit': limit},
      fromJson: PaginatedSessions.fromJson,
    );
  }

  Future<List<TrustedDevice>> listTrustedDevices() {
    return _apiClient.getListPlain('/security/trusted-devices', fromJson: TrustedDevice.fromJson);
  }

  Future<void> revokeTrustedDevice(String id) {
    return _apiClient.delete('/security/trusted-devices/$id', fromJson: (json) => json);
  }

  Future<List<ApiKey>> listApiKeys() {
    return _apiClient.getListPlain('/security/api-keys', fromJson: ApiKey.fromJson);
  }

  Future<CreateApiKeyResult> createApiKey({
    required String name,
    required List<String> scopedPermissions,
    String? expiresAt,
  }) {
    return _apiClient.post(
      '/security/api-keys',
      data: {
        'name': name,
        'scopedPermissions': scopedPermissions,
        'expiresAt': ?expiresAt,
      },
      fromJson: CreateApiKeyResult.fromJson,
    );
  }

  Future<void> revokeApiKey(String id) {
    return _apiClient.delete('/security/api-keys/$id', fromJson: (json) => json);
  }

  Future<MfaSetupResult> setupMfa() {
    return _apiClient.post('/security/mfa/setup', fromJson: MfaSetupResult.fromJson);
  }

  Future<MfaBackupCodesResult> verifyMfaSetup(String code) {
    return _apiClient.post(
      '/security/mfa/setup/verify',
      data: {'code': code},
      fromJson: MfaBackupCodesResult.fromJson,
    );
  }

  Future<void> disableMfa(String code) {
    return _apiClient.post('/security/mfa/disable', data: {'code': code}, fromJson: (json) => json);
  }

  Future<MfaBackupCodesResult> regenerateBackupCodes(String code) {
    return _apiClient.post(
      '/security/mfa/backup-codes/regenerate',
      data: {'code': code},
      fromJson: MfaBackupCodesResult.fromJson,
    );
  }
}

SecurityException mapToSecurityException(Object error) {
  if (error is SecurityException) {
    return error;
  }
  if (error is NetworkException) {
    return SecurityException(
      error.statusCode == null ? friendlyNetworkFailureMessage(error) : error.message,
    );
  }
  return const SecurityException('Unable to complete security request.');
}

class SecurityException implements Exception {
  const SecurityException(this.message);

  final String message;

  @override
  String toString() => message;
}
