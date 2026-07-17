import 'package:flutter_test/flutter_test.dart';
import 'package:voltx_mobile/core/network/network_exception.dart';
import 'package:voltx_mobile/features/security/data/models/security_models.dart';
import 'package:voltx_mobile/features/security/data/services/security_api_service.dart';

void main() {
  group('PasswordPolicy.fromJson', () {
    test('defaults every field when omitted', () {
      final policy = PasswordPolicy.fromJson(const {});

      expect(policy.minLength, 8);
      expect(policy.requireUppercase, isFalse);
      expect(policy.requireNumber, isFalse);
      expect(policy.requireSymbol, isFalse);
    });

    test('round-trips through toJson', () {
      const policy = PasswordPolicy(
        minLength: 12,
        requireUppercase: true,
        requireNumber: true,
        requireSymbol: false,
      );

      expect(PasswordPolicy.fromJson(policy.toJson()).minLength, 12);
    });
  });

  group('SecurityPolicy.fromJson', () {
    test('parses a nested password policy and ip allowlist', () {
      final policy = SecurityPolicy.fromJson({
        'mfaRequired': true,
        'passwordPolicy': {'minLength': 10, 'requireSymbol': true},
        'ipAllowlist': ['10.0.0.1', '10.0.0.2'],
      });

      expect(policy.mfaRequired, isTrue);
      expect(policy.passwordPolicy.minLength, 10);
      expect(policy.ipAllowlist, ['10.0.0.1', '10.0.0.2']);
    });

    test('defaults ipAllowlist to empty and builds a default password policy when omitted', () {
      final policy = SecurityPolicy.fromJson(const {});

      expect(policy.ipAllowlist, isEmpty);
      expect(policy.passwordPolicy.minLength, 8);
    });
  });

  group('PaginatedSessions', () {
    test('fromJson parses items and falls back total/limit to item count', () {
      final page = PaginatedSessions.fromJson({
        'items': [
          {
            'id': 'session-1',
            'lastActiveAt': '2026-01-01T00:00:00.000Z',
            'createdAt': '2026-01-01T00:00:00.000Z',
          },
        ],
      });

      expect(page.items, hasLength(1));
      expect(page.total, 1);
      expect(page.page, 1);
    });

    test('totalPages rounds up and is never less than 1', () {
      const page = PaginatedSessions(items: [], total: 25, page: 1, limit: 10);
      expect(page.totalPages, 3);

      const emptyPage = PaginatedSessions(items: [], total: 0, page: 1, limit: 10);
      expect(emptyPage.totalPages, 1);
    });

    test('totalPages does not divide by zero when limit is 0', () {
      const page = PaginatedSessions(items: [], total: 5, page: 1, limit: 0);
      expect(page.totalPages, 1);
    });
  });

  group('CreateApiKeyResult.fromJson', () {
    test('parses the base ApiKey fields plus the one-time plaintext apiKey', () {
      final result = CreateApiKeyResult.fromJson({
        'id': 'key-1',
        'name': 'CI key',
        'keyPrefix': 'vlx_',
        'scopedPermissions': ['workflows.read'],
        'createdAt': '2026-01-01T00:00:00.000Z',
        'apiKey': 'vlx_secret_value',
      });

      expect(result.apiKey, 'vlx_secret_value');
      expect(result.scopedPermissions, ['workflows.read']);
    });
  });

  group('MfaBackupCodesResult.fromJson', () {
    test('defaults backupCodes to an empty list when omitted', () {
      final result = MfaBackupCodesResult.fromJson(const {});
      expect(result.backupCodes, isEmpty);
    });
  });

  group('mapToSecurityException', () {
    test('passes an existing SecurityException through unchanged', () {
      const original = SecurityException('already mapped');
      expect(mapToSecurityException(original), same(original));
    });

    test('uses the backend message for a NetworkException with a status code', () {
      const error = NetworkException(message: 'Incorrect MFA code', statusCode: 400);
      expect(mapToSecurityException(error).message, 'Incorrect MFA code');
    });

    test('uses a friendly message for a NetworkException with no status code', () {
      const error = NetworkException(
        message: 'timed out',
        type: NetworkExceptionType.timeout,
      );
      expect(mapToSecurityException(error).message, contains('timed out'));
    });

    test('falls back to a generic message for any other error type', () {
      expect(
        mapToSecurityException(StateError('boom')).message,
        'Unable to complete security request.',
      );
    });
  });
}
