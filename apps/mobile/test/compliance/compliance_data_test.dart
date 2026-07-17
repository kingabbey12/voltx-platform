import 'package:flutter_test/flutter_test.dart';
import 'package:voltx_mobile/core/network/network_exception.dart';
import 'package:voltx_mobile/features/compliance/data/models/compliance_models.dart';
import 'package:voltx_mobile/features/compliance/data/services/compliance_api_service.dart';

void main() {
  group('ConsentRecord.fromJson', () {
    test('parses a full record', () {
      final record = ConsentRecord.fromJson({
        'id': 'consent-1',
        'userId': 'user-1',
        'consentType': 'marketing',
        'granted': true,
        'grantedAt': '2026-01-01T00:00:00.000Z',
        'revokedAt': null,
        'createdAt': '2026-01-01T00:00:00.000Z',
      });

      expect(record.id, 'consent-1');
      expect(record.granted, isTrue);
      expect(record.revokedAt, isNull);
    });

    test('defaults granted to false when omitted', () {
      final record = ConsentRecord.fromJson({
        'id': 'consent-1',
        'userId': 'user-1',
        'consentType': 'marketing',
        'createdAt': '2026-01-01T00:00:00.000Z',
      });

      expect(record.granted, isFalse);
    });
  });

  group('GdprExportResult.fromJson', () {
    test('parses nested sections and the excluded-from-erasure list', () {
      final result = GdprExportResult.fromJson({
        'organizationId': 'org-1',
        'userId': 'user-1',
        'exportedAt': '2026-01-01T00:00:00.000Z',
        'downloadUrl': 'https://example.com/export.json',
        'expiresAt': '2026-01-02T00:00:00.000Z',
        'sections': [
          {'model': 'notifications', 'label': 'Notifications', 'rowCount': 3},
        ],
        'excludedFromErasure': ['auditLog'],
      });

      expect(result.sections, hasLength(1));
      expect(result.sections.single.rowCount, 3);
      expect(result.excludedFromErasure, ['auditLog']);
    });

    test('defaults sections and excludedFromErasure to empty lists when omitted', () {
      final result = GdprExportResult.fromJson({
        'organizationId': 'org-1',
        'userId': 'user-1',
        'exportedAt': '2026-01-01T00:00:00.000Z',
        'downloadUrl': 'https://example.com/export.json',
        'expiresAt': '2026-01-02T00:00:00.000Z',
      });

      expect(result.sections, isEmpty);
      expect(result.excludedFromErasure, isEmpty);
    });
  });

  group('GdprDeletionResult.fromJson', () {
    test('parses erasure outcomes including the optional reason', () {
      final result = GdprDeletionResult.fromJson({
        'organizationId': 'org-1',
        'userId': 'user-1',
        'globalIdentityScrubbed': true,
        'results': [
          {
            'model': 'auditLog',
            'label': 'Audit Log',
            'action': 'retained',
            'affected': 0,
            'reason': 'legal hold active',
          },
        ],
      });

      expect(result.globalIdentityScrubbed, isTrue);
      expect(result.results.single.reason, 'legal hold active');
    });
  });

  group('LegalHold.fromJson', () {
    test('parses scope as a map and preserves optional release fields', () {
      final hold = LegalHold.fromJson({
        'id': 'hold-1',
        'name': 'Litigation hold',
        'reason': 'Pending lawsuit',
        'status': 'ACTIVE',
        'scope': {'resource': 'ALL'},
        'createdBy': 'user-1',
        'createdAt': '2026-01-01T00:00:00.000Z',
      });

      expect(hold.scope, {'resource': 'ALL'});
      expect(hold.releasedAt, isNull);
      expect(hold.targetUserId, isNull);
    });

    test('defaults scope to an empty map when omitted', () {
      final hold = LegalHold.fromJson({
        'id': 'hold-1',
        'name': 'Litigation hold',
        'reason': 'Pending lawsuit',
        'status': 'ACTIVE',
        'createdBy': 'user-1',
        'createdAt': '2026-01-01T00:00:00.000Z',
      });

      expect(hold.scope, isEmpty);
    });
  });

  group('AuditExport.fromJson', () {
    test('parses a completed export with a download URL and row count', () {
      final export = AuditExport.fromJson({
        'id': 'export-1',
        'status': 'COMPLETED',
        'format': 'CSV',
        'fromDate': '2026-01-01',
        'toDate': '2026-01-31',
        'rowCount': 42,
        'downloadUrl': 'https://example.com/export.csv',
        'createdAt': '2026-01-01T00:00:00.000Z',
      });

      expect(export.rowCount, 42);
      expect(export.errorMessage, isNull);
    });
  });

  group('AuditChainVerifyResult.fromJson', () {
    test('parses a broken chain result with the failing index and log id', () {
      final result = AuditChainVerifyResult.fromJson({
        'valid': false,
        'checked': 10,
        'brokenAtIndex': 3,
        'brokenAuditLogId': 'log-3',
      });

      expect(result.valid, isFalse);
      expect(result.brokenAtIndex, 3);
    });

    test('defaults valid to false and checked to 0 when omitted', () {
      final result = AuditChainVerifyResult.fromJson(const {});

      expect(result.valid, isFalse);
      expect(result.checked, 0);
      expect(result.brokenAtIndex, isNull);
    });
  });

  group('RetentionPolicy.fromJson', () {
    test('defaults isActive to true when omitted', () {
      final policy = RetentionPolicy.fromJson({
        'id': 'policy-1',
        'resourceType': 'AUDIT_LOG',
        'retentionDays': 90,
        'action': 'DELETE',
        'createdBy': 'user-1',
        'createdAt': '2026-01-01T00:00:00.000Z',
      });

      expect(policy.isActive, isTrue);
    });
  });

  group('mapToComplianceException', () {
    test('passes an existing ComplianceException through unchanged', () {
      const original = ComplianceException('already mapped');
      expect(mapToComplianceException(original), same(original));
    });

    test('uses the backend message for a NetworkException with a status code', () {
      const error = NetworkException(message: 'Legal hold blocks erasure', statusCode: 409);
      final result = mapToComplianceException(error);
      expect(result.message, 'Legal hold blocks erasure');
    });

    test('uses a friendly offline message for a NetworkException with no status code', () {
      const error = NetworkException(
        message: 'Connection refused',
        type: NetworkExceptionType.offline,
      );
      final result = mapToComplianceException(error);
      expect(result.message, contains("You're offline"));
    });

    test('falls back to a generic message for any other error type', () {
      final result = mapToComplianceException(StateError('boom'));
      expect(result.message, 'Unable to complete compliance request.');
    });
  });
}
