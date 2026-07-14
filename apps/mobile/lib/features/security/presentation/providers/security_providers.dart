import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/network_providers.dart';
import '../../../auth/presentation/providers/auth_providers.dart';
import '../../data/models/security_models.dart';
import '../../data/repositories/security_repository.dart';
import '../../data/services/security_api_service.dart';

final securityApiServiceProvider = Provider<SecurityApiService>((ref) {
  return SecurityApiService(ref.watch(apiClientProvider));
});

final securityRepositoryProvider = Provider<SecurityRepository>((ref) {
  return ApiSecurityRepository(ref.watch(securityApiServiceProvider));
});

final securityPolicyProvider = FutureProvider<SecurityPolicy>((ref) {
  final organizationId = ref.watch(authSessionProvider)?.organizationId;
  if (organizationId == null) {
    throw StateError('No active organization');
  }
  return ref.watch(securityRepositoryProvider).getPolicy(organizationId);
});

final sessionsProvider = FutureProvider<List<Session>>((ref) {
  return ref.watch(securityRepositoryProvider).listSessions();
});

final trustedDevicesProvider = FutureProvider<List<TrustedDevice>>((ref) {
  return ref.watch(securityRepositoryProvider).listTrustedDevices();
});

final apiKeysProvider = FutureProvider<List<ApiKey>>((ref) {
  return ref.watch(securityRepositoryProvider).listApiKeys();
});

final loginHistoryPageProvider = StateProvider<int>((ref) => 1);

final loginHistoryProvider = FutureProvider.family<PaginatedSessions, int>((ref, page) {
  return ref.watch(securityRepositoryProvider).loginHistory(page: page, limit: 20);
});

/// Drives every Security Center mutation (policy update, session/device/
/// key revoke, API key creation, MFA enroll/disable/backup-codes) with a
/// loading flag and error surface, invalidating affected providers on
/// success — same shape as IntegrationActionController.
class SecurityActionState {
  const SecurityActionState({this.isLoading = false, this.errorMessage});

  final bool isLoading;
  final String? errorMessage;

  SecurityActionState copyWith({bool? isLoading, String? errorMessage, bool clearError = false}) {
    return SecurityActionState(
      isLoading: isLoading ?? this.isLoading,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
    );
  }
}

class SecurityActionController extends StateNotifier<SecurityActionState> {
  SecurityActionController(this._ref) : super(const SecurityActionState());

  final Ref _ref;

  SecurityRepository get _repository => _ref.read(securityRepositoryProvider);

  Future<bool> updatePolicy(
    String organizationId, {
    bool? mfaRequired,
    PasswordPolicy? passwordPolicy,
    List<String>? ipAllowlist,
  }) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      await _repository.updatePolicy(
        organizationId,
        mfaRequired: mfaRequired,
        passwordPolicy: passwordPolicy,
        ipAllowlist: ipAllowlist,
      );
      _ref.invalidate(securityPolicyProvider);
      state = state.copyWith(isLoading: false);
      return true;
    } catch (error) {
      state = state.copyWith(isLoading: false, errorMessage: error.toString());
      return false;
    }
  }

  Future<bool> revokeSession(String id) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      await _repository.revokeSession(id);
      _ref.invalidate(sessionsProvider);
      state = state.copyWith(isLoading: false);
      return true;
    } catch (error) {
      state = state.copyWith(isLoading: false, errorMessage: error.toString());
      return false;
    }
  }

  Future<bool> revokeTrustedDevice(String id) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      await _repository.revokeTrustedDevice(id);
      _ref.invalidate(trustedDevicesProvider);
      state = state.copyWith(isLoading: false);
      return true;
    } catch (error) {
      state = state.copyWith(isLoading: false, errorMessage: error.toString());
      return false;
    }
  }

  Future<CreateApiKeyResult?> createApiKey({
    required String name,
    required List<String> scopedPermissions,
    String? expiresAt,
  }) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final result =
          await _repository.createApiKey(name: name, scopedPermissions: scopedPermissions, expiresAt: expiresAt);
      _ref.invalidate(apiKeysProvider);
      state = state.copyWith(isLoading: false);
      return result;
    } catch (error) {
      state = state.copyWith(isLoading: false, errorMessage: error.toString());
      return null;
    }
  }

  Future<bool> revokeApiKey(String id) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      await _repository.revokeApiKey(id);
      _ref.invalidate(apiKeysProvider);
      state = state.copyWith(isLoading: false);
      return true;
    } catch (error) {
      state = state.copyWith(isLoading: false, errorMessage: error.toString());
      return false;
    }
  }

  Future<MfaSetupResult?> setupMfa() async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final result = await _repository.setupMfa();
      state = state.copyWith(isLoading: false);
      return result;
    } catch (error) {
      state = state.copyWith(isLoading: false, errorMessage: error.toString());
      return null;
    }
  }

  Future<MfaBackupCodesResult?> verifyMfaSetup(String code) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final result = await _repository.verifyMfaSetup(code);
      state = state.copyWith(isLoading: false);
      return result;
    } catch (error) {
      state = state.copyWith(isLoading: false, errorMessage: error.toString());
      return null;
    }
  }

  Future<bool> disableMfa(String code) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      await _repository.disableMfa(code);
      state = state.copyWith(isLoading: false);
      return true;
    } catch (error) {
      state = state.copyWith(isLoading: false, errorMessage: error.toString());
      return false;
    }
  }

  Future<MfaBackupCodesResult?> regenerateBackupCodes(String code) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final result = await _repository.regenerateBackupCodes(code);
      state = state.copyWith(isLoading: false);
      return result;
    } catch (error) {
      state = state.copyWith(isLoading: false, errorMessage: error.toString());
      return null;
    }
  }

  void clearError() => state = state.copyWith(clearError: true);
}

final securityActionControllerProvider =
    StateNotifierProvider<SecurityActionController, SecurityActionState>((ref) {
  return SecurityActionController(ref);
});
