import '../models/security_models.dart';
import '../services/security_api_service.dart';

abstract class SecurityRepository {
  Future<SecurityPolicy> getPolicy(String organizationId);
  Future<SecurityPolicy> updatePolicy(
    String organizationId, {
    bool? mfaRequired,
    PasswordPolicy? passwordPolicy,
    List<String>? ipAllowlist,
  });
  Future<List<Session>> listSessions();
  Future<void> revokeSession(String id);
  Future<PaginatedSessions> loginHistory({int page, int limit});
  Future<List<TrustedDevice>> listTrustedDevices();
  Future<void> revokeTrustedDevice(String id);
  Future<List<ApiKey>> listApiKeys();
  Future<CreateApiKeyResult> createApiKey({
    required String name,
    required List<String> scopedPermissions,
    String? expiresAt,
  });
  Future<void> revokeApiKey(String id);
  Future<MfaSetupResult> setupMfa();
  Future<MfaBackupCodesResult> verifyMfaSetup(String code);
  Future<void> disableMfa(String code);
  Future<MfaBackupCodesResult> regenerateBackupCodes(String code);
}

class ApiSecurityRepository implements SecurityRepository {
  ApiSecurityRepository(this._api);

  final SecurityApiService _api;

  @override
  Future<SecurityPolicy> getPolicy(String organizationId) async {
    try {
      return await _api.getPolicy(organizationId);
    } catch (error) {
      throw mapToSecurityException(error);
    }
  }

  @override
  Future<SecurityPolicy> updatePolicy(
    String organizationId, {
    bool? mfaRequired,
    PasswordPolicy? passwordPolicy,
    List<String>? ipAllowlist,
  }) async {
    try {
      return await _api.updatePolicy(
        organizationId,
        mfaRequired: mfaRequired,
        passwordPolicy: passwordPolicy,
        ipAllowlist: ipAllowlist,
      );
    } catch (error) {
      throw mapToSecurityException(error);
    }
  }

  @override
  Future<List<Session>> listSessions() async {
    try {
      return await _api.listSessions();
    } catch (error) {
      throw mapToSecurityException(error);
    }
  }

  @override
  Future<void> revokeSession(String id) async {
    try {
      await _api.revokeSession(id);
    } catch (error) {
      throw mapToSecurityException(error);
    }
  }

  @override
  Future<PaginatedSessions> loginHistory({int page = 1, int limit = 20}) async {
    try {
      return await _api.loginHistory(page: page, limit: limit);
    } catch (error) {
      throw mapToSecurityException(error);
    }
  }

  @override
  Future<List<TrustedDevice>> listTrustedDevices() async {
    try {
      return await _api.listTrustedDevices();
    } catch (error) {
      throw mapToSecurityException(error);
    }
  }

  @override
  Future<void> revokeTrustedDevice(String id) async {
    try {
      await _api.revokeTrustedDevice(id);
    } catch (error) {
      throw mapToSecurityException(error);
    }
  }

  @override
  Future<List<ApiKey>> listApiKeys() async {
    try {
      return await _api.listApiKeys();
    } catch (error) {
      throw mapToSecurityException(error);
    }
  }

  @override
  Future<CreateApiKeyResult> createApiKey({
    required String name,
    required List<String> scopedPermissions,
    String? expiresAt,
  }) async {
    try {
      return await _api.createApiKey(name: name, scopedPermissions: scopedPermissions, expiresAt: expiresAt);
    } catch (error) {
      throw mapToSecurityException(error);
    }
  }

  @override
  Future<void> revokeApiKey(String id) async {
    try {
      await _api.revokeApiKey(id);
    } catch (error) {
      throw mapToSecurityException(error);
    }
  }

  @override
  Future<MfaSetupResult> setupMfa() async {
    try {
      return await _api.setupMfa();
    } catch (error) {
      throw mapToSecurityException(error);
    }
  }

  @override
  Future<MfaBackupCodesResult> verifyMfaSetup(String code) async {
    try {
      return await _api.verifyMfaSetup(code);
    } catch (error) {
      throw mapToSecurityException(error);
    }
  }

  @override
  Future<void> disableMfa(String code) async {
    try {
      await _api.disableMfa(code);
    } catch (error) {
      throw mapToSecurityException(error);
    }
  }

  @override
  Future<MfaBackupCodesResult> regenerateBackupCodes(String code) async {
    try {
      return await _api.regenerateBackupCodes(code);
    } catch (error) {
      throw mapToSecurityException(error);
    }
  }
}
