import '../models/compliance_models.dart';
import '../services/compliance_api_service.dart';

abstract class ComplianceRepository {
  Future<List<ConsentRecord>> listConsentRecords({String? userId, String? consentType});
  Future<ConsentRecord> createConsentRecord({
    required String userId,
    required String consentType,
    required bool granted,
  });
  Future<GdprExportResult> exportUserData(String userId);
  Future<GdprDeletionResult> deleteUserData(String userId);
  Future<List<LegalHold>> listLegalHolds();
  Future<LegalHold> createLegalHold({required String name, required String reason, String? targetUserId});
  Future<LegalHold> releaseLegalHold(String id);
  Future<AuditExport> createAuditExport({required String fromDate, required String toDate, String format});
  Future<AuditExport> getAuditExport(String id);
  Future<AuditChainVerifyResult> verifyAuditChain();
  Future<List<RetentionPolicy>> listRetentionPolicies();
  Future<RetentionPolicy> createRetentionPolicy({
    required String resourceType,
    required int retentionDays,
    required String action,
  });
  Future<RetentionPolicy> updateRetentionPolicy(
    String id, {
    int? retentionDays,
    String? action,
    bool? isActive,
  });
  Future<void> deleteRetentionPolicy(String id);
}

class ApiComplianceRepository implements ComplianceRepository {
  ApiComplianceRepository(this._api);

  final ComplianceApiService _api;

  @override
  Future<List<ConsentRecord>> listConsentRecords({String? userId, String? consentType}) async {
    try {
      return await _api.listConsentRecords(userId: userId, consentType: consentType);
    } catch (error) {
      throw mapToComplianceException(error);
    }
  }

  @override
  Future<ConsentRecord> createConsentRecord({
    required String userId,
    required String consentType,
    required bool granted,
  }) async {
    try {
      return await _api.createConsentRecord(userId: userId, consentType: consentType, granted: granted);
    } catch (error) {
      throw mapToComplianceException(error);
    }
  }

  @override
  Future<GdprExportResult> exportUserData(String userId) async {
    try {
      return await _api.exportUserData(userId);
    } catch (error) {
      throw mapToComplianceException(error);
    }
  }

  @override
  Future<GdprDeletionResult> deleteUserData(String userId) async {
    try {
      return await _api.deleteUserData(userId);
    } catch (error) {
      throw mapToComplianceException(error);
    }
  }

  @override
  Future<List<LegalHold>> listLegalHolds() async {
    try {
      return await _api.listLegalHolds();
    } catch (error) {
      throw mapToComplianceException(error);
    }
  }

  @override
  Future<LegalHold> createLegalHold({
    required String name,
    required String reason,
    String? targetUserId,
  }) async {
    try {
      return await _api.createLegalHold(name: name, reason: reason, targetUserId: targetUserId);
    } catch (error) {
      throw mapToComplianceException(error);
    }
  }

  @override
  Future<LegalHold> releaseLegalHold(String id) async {
    try {
      return await _api.releaseLegalHold(id);
    } catch (error) {
      throw mapToComplianceException(error);
    }
  }

  @override
  Future<AuditExport> createAuditExport({
    required String fromDate,
    required String toDate,
    String format = 'JSON',
  }) async {
    try {
      return await _api.createAuditExport(fromDate: fromDate, toDate: toDate, format: format);
    } catch (error) {
      throw mapToComplianceException(error);
    }
  }

  @override
  Future<AuditExport> getAuditExport(String id) async {
    try {
      return await _api.getAuditExport(id);
    } catch (error) {
      throw mapToComplianceException(error);
    }
  }

  @override
  Future<AuditChainVerifyResult> verifyAuditChain() async {
    try {
      return await _api.verifyAuditChain();
    } catch (error) {
      throw mapToComplianceException(error);
    }
  }

  @override
  Future<List<RetentionPolicy>> listRetentionPolicies() async {
    try {
      return await _api.listRetentionPolicies();
    } catch (error) {
      throw mapToComplianceException(error);
    }
  }

  @override
  Future<RetentionPolicy> createRetentionPolicy({
    required String resourceType,
    required int retentionDays,
    required String action,
  }) async {
    try {
      return await _api.createRetentionPolicy(
        resourceType: resourceType,
        retentionDays: retentionDays,
        action: action,
      );
    } catch (error) {
      throw mapToComplianceException(error);
    }
  }

  @override
  Future<RetentionPolicy> updateRetentionPolicy(
    String id, {
    int? retentionDays,
    String? action,
    bool? isActive,
  }) async {
    try {
      return await _api.updateRetentionPolicy(id, retentionDays: retentionDays, action: action, isActive: isActive);
    } catch (error) {
      throw mapToComplianceException(error);
    }
  }

  @override
  Future<void> deleteRetentionPolicy(String id) async {
    try {
      await _api.deleteRetentionPolicy(id);
    } catch (error) {
      throw mapToComplianceException(error);
    }
  }
}
