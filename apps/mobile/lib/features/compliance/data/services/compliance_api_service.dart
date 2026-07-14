import '../../../../core/network/api_client.dart';
import '../../../../core/network/network_exception.dart';
import '../models/compliance_models.dart';

class ComplianceApiService {
  ComplianceApiService(this._apiClient);

  final ApiClient _apiClient;

  Future<List<ConsentRecord>> listConsentRecords({String? userId, String? consentType}) {
    return _apiClient.getListPlain(
      '/compliance/consent-records',
      queryParameters: {
        'userId': ?userId,
        'consentType': ?consentType,
      },
      fromJson: ConsentRecord.fromJson,
    );
  }

  Future<ConsentRecord> createConsentRecord({
    required String userId,
    required String consentType,
    required bool granted,
  }) {
    return _apiClient.post(
      '/compliance/consent-records',
      data: {'userId': userId, 'consentType': consentType, 'granted': granted},
      fromJson: ConsentRecord.fromJson,
    );
  }

  Future<GdprExportResult> exportUserData(String userId) {
    return _apiClient.post(
      '/compliance/gdpr/export',
      data: {'userId': userId},
      fromJson: GdprExportResult.fromJson,
    );
  }

  Future<GdprDeletionResult> deleteUserData(String userId) {
    return _apiClient.post(
      '/compliance/gdpr/delete',
      data: {'userId': userId},
      fromJson: GdprDeletionResult.fromJson,
    );
  }

  Future<List<LegalHold>> listLegalHolds() {
    return _apiClient.getListPlain('/compliance/legal-holds', fromJson: LegalHold.fromJson);
  }

  Future<LegalHold> createLegalHold({
    required String name,
    required String reason,
    String? targetUserId,
  }) {
    return _apiClient.post(
      '/compliance/legal-holds',
      data: {'name': name, 'reason': reason, 'targetUserId': ?targetUserId},
      fromJson: LegalHold.fromJson,
    );
  }

  Future<LegalHold> releaseLegalHold(String id) {
    return _apiClient.post('/compliance/legal-holds/$id/release', fromJson: LegalHold.fromJson);
  }

  Future<AuditExport> createAuditExport({
    required String fromDate,
    required String toDate,
    String format = 'JSON',
  }) {
    return _apiClient.post(
      '/compliance/audit/export',
      data: {'fromDate': fromDate, 'toDate': toDate, 'format': format},
      fromJson: AuditExport.fromJson,
    );
  }

  Future<AuditExport> getAuditExport(String id) {
    return _apiClient.get('/compliance/audit/export/$id', fromJson: AuditExport.fromJson);
  }

  Future<AuditChainVerifyResult> verifyAuditChain() {
    return _apiClient.get('/compliance/audit/verify', fromJson: AuditChainVerifyResult.fromJson);
  }

  Future<List<RetentionPolicy>> listRetentionPolicies() {
    return _apiClient.getListPlain('/compliance/retention-policies', fromJson: RetentionPolicy.fromJson);
  }

  Future<RetentionPolicy> createRetentionPolicy({
    required String resourceType,
    required int retentionDays,
    required String action,
  }) {
    return _apiClient.post(
      '/compliance/retention-policies',
      data: {'resourceType': resourceType, 'retentionDays': retentionDays, 'action': action},
      fromJson: RetentionPolicy.fromJson,
    );
  }

  Future<RetentionPolicy> updateRetentionPolicy(
    String id, {
    int? retentionDays,
    String? action,
    bool? isActive,
  }) {
    return _apiClient.patch(
      '/compliance/retention-policies/$id',
      data: {
        'retentionDays': ?retentionDays,
        'action': ?action,
        'isActive': ?isActive,
      },
      fromJson: RetentionPolicy.fromJson,
    );
  }

  Future<void> deleteRetentionPolicy(String id) {
    return _apiClient.delete('/compliance/retention-policies/$id', fromJson: (json) => json);
  }
}

ComplianceException mapToComplianceException(Object error) {
  if (error is ComplianceException) {
    return error;
  }
  if (error is NetworkException) {
    return ComplianceException(
      error.statusCode == null ? friendlyNetworkFailureMessage(error) : error.message,
    );
  }
  return const ComplianceException('Unable to complete compliance request.');
}

class ComplianceException implements Exception {
  const ComplianceException(this.message);

  final String message;

  @override
  String toString() => message;
}
