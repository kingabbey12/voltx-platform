import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/network_providers.dart';
import '../../data/models/compliance_models.dart';
import '../../data/repositories/compliance_repository.dart';
import '../../data/services/compliance_api_service.dart';

final complianceApiServiceProvider = Provider<ComplianceApiService>((ref) {
  return ComplianceApiService(ref.watch(apiClientProvider));
});

final complianceRepositoryProvider = Provider<ComplianceRepository>((ref) {
  return ApiComplianceRepository(ref.watch(complianceApiServiceProvider));
});

final consentRecordsProvider = FutureProvider<List<ConsentRecord>>((ref) {
  return ref.watch(complianceRepositoryProvider).listConsentRecords();
});

final legalHoldsProvider = FutureProvider<List<LegalHold>>((ref) {
  return ref.watch(complianceRepositoryProvider).listLegalHolds();
});

final retentionPoliciesProvider = FutureProvider<List<RetentionPolicy>>((ref) {
  return ref.watch(complianceRepositoryProvider).listRetentionPolicies();
});

final auditExportIdProvider = StateProvider<String?>((ref) => null);

final auditExportStatusProvider = FutureProvider.family<AuditExport, String>((ref, id) {
  return ref.watch(complianceRepositoryProvider).getAuditExport(id);
});

/// Drives every Compliance Center mutation (consent logging, GDPR export/
/// erasure, legal hold place/release, audit export/verify, retention
/// policy CRUD) with a loading flag, error surface, and per-action result
/// payloads the screens render directly.
class ComplianceActionState {
  const ComplianceActionState({
    this.isLoading = false,
    this.errorMessage,
    this.lastExport,
    this.lastDeletion,
    this.lastVerify,
  });

  final bool isLoading;
  final String? errorMessage;
  final GdprExportResult? lastExport;
  final GdprDeletionResult? lastDeletion;
  final AuditChainVerifyResult? lastVerify;

  ComplianceActionState copyWith({
    bool? isLoading,
    String? errorMessage,
    bool clearError = false,
    GdprExportResult? lastExport,
    GdprDeletionResult? lastDeletion,
    AuditChainVerifyResult? lastVerify,
  }) {
    return ComplianceActionState(
      isLoading: isLoading ?? this.isLoading,
      errorMessage: clearError ? null : (errorMessage ?? this.errorMessage),
      lastExport: lastExport ?? this.lastExport,
      lastDeletion: lastDeletion ?? this.lastDeletion,
      lastVerify: lastVerify ?? this.lastVerify,
    );
  }
}

class ComplianceActionController extends StateNotifier<ComplianceActionState> {
  ComplianceActionController(this._ref) : super(const ComplianceActionState());

  final Ref _ref;

  ComplianceRepository get _repository => _ref.read(complianceRepositoryProvider);

  Future<bool> createConsentRecord({
    required String userId,
    required String consentType,
    required bool granted,
  }) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      await _repository.createConsentRecord(userId: userId, consentType: consentType, granted: granted);
      _ref.invalidate(consentRecordsProvider);
      state = state.copyWith(isLoading: false);
      return true;
    } catch (error) {
      state = state.copyWith(isLoading: false, errorMessage: error.toString());
      return false;
    }
  }

  Future<bool> exportUserData(String userId) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final result = await _repository.exportUserData(userId);
      state = state.copyWith(isLoading: false, lastExport: result);
      return true;
    } catch (error) {
      state = state.copyWith(isLoading: false, errorMessage: error.toString());
      return false;
    }
  }

  Future<bool> deleteUserData(String userId) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final result = await _repository.deleteUserData(userId);
      state = state.copyWith(isLoading: false, lastDeletion: result);
      return true;
    } catch (error) {
      state = state.copyWith(isLoading: false, errorMessage: error.toString());
      return false;
    }
  }

  Future<bool> createLegalHold({required String name, required String reason, String? targetUserId}) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      await _repository.createLegalHold(name: name, reason: reason, targetUserId: targetUserId);
      _ref.invalidate(legalHoldsProvider);
      state = state.copyWith(isLoading: false);
      return true;
    } catch (error) {
      state = state.copyWith(isLoading: false, errorMessage: error.toString());
      return false;
    }
  }

  Future<bool> releaseLegalHold(String id) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      await _repository.releaseLegalHold(id);
      _ref.invalidate(legalHoldsProvider);
      state = state.copyWith(isLoading: false);
      return true;
    } catch (error) {
      state = state.copyWith(isLoading: false, errorMessage: error.toString());
      return false;
    }
  }

  Future<String?> createAuditExport({required String fromDate, required String toDate, String format = 'JSON'}) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final result = await _repository.createAuditExport(fromDate: fromDate, toDate: toDate, format: format);
      state = state.copyWith(isLoading: false);
      return result.id;
    } catch (error) {
      state = state.copyWith(isLoading: false, errorMessage: error.toString());
      return null;
    }
  }

  Future<void> verifyAuditChain() async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      final result = await _repository.verifyAuditChain();
      state = state.copyWith(isLoading: false, lastVerify: result);
    } catch (error) {
      state = state.copyWith(isLoading: false, errorMessage: error.toString());
    }
  }

  Future<bool> createRetentionPolicy({
    required String resourceType,
    required int retentionDays,
    required String action,
  }) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      await _repository.createRetentionPolicy(resourceType: resourceType, retentionDays: retentionDays, action: action);
      _ref.invalidate(retentionPoliciesProvider);
      state = state.copyWith(isLoading: false);
      return true;
    } catch (error) {
      state = state.copyWith(isLoading: false, errorMessage: error.toString());
      return false;
    }
  }

  Future<bool> updateRetentionPolicy(String id, {int? retentionDays, String? action, bool? isActive}) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      await _repository.updateRetentionPolicy(id, retentionDays: retentionDays, action: action, isActive: isActive);
      _ref.invalidate(retentionPoliciesProvider);
      state = state.copyWith(isLoading: false);
      return true;
    } catch (error) {
      state = state.copyWith(isLoading: false, errorMessage: error.toString());
      return false;
    }
  }

  Future<bool> deleteRetentionPolicy(String id) async {
    state = state.copyWith(isLoading: true, clearError: true);
    try {
      await _repository.deleteRetentionPolicy(id);
      _ref.invalidate(retentionPoliciesProvider);
      state = state.copyWith(isLoading: false);
      return true;
    } catch (error) {
      state = state.copyWith(isLoading: false, errorMessage: error.toString());
      return false;
    }
  }
}

final complianceActionControllerProvider =
    StateNotifierProvider<ComplianceActionController, ComplianceActionState>((ref) {
  return ComplianceActionController(ref);
});
