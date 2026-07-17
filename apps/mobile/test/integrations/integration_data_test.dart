import 'package:flutter_test/flutter_test.dart';
import 'package:voltx_mobile/core/network/network_exception.dart';
import 'package:voltx_mobile/features/integrations/data/models/integration_models.dart';
import 'package:voltx_mobile/features/integrations/data/services/integration_api_service.dart';

void main() {
  group('IntegrationPageQuery', () {
    test('toQueryParameters omits provider/status when null', () {
      const query = IntegrationPageQuery(page: 2, limit: 10);
      expect(query.toQueryParameters(), {'page': 2, 'limit': 10});
    });

    test('toQueryParameters includes provider/status when set', () {
      const query = IntegrationPageQuery(page: 1, limit: 20, provider: 'SLACK', status: 'CONNECTED');
      expect(
        query.toQueryParameters(),
        {'page': 1, 'limit': 20, 'provider': 'SLACK', 'status': 'CONNECTED'},
      );
    });

    test('equality and hashCode are value-based', () {
      const a = IntegrationPageQuery(page: 1, limit: 20, provider: 'SLACK');
      const b = IntegrationPageQuery(page: 1, limit: 20, provider: 'SLACK');
      const c = IntegrationPageQuery(page: 2, limit: 20, provider: 'SLACK');

      expect(a, equals(b));
      expect(a.hashCode, b.hashCode);
      expect(a, isNot(equals(c)));
    });
  });

  group('PaginatedIntegrationResult.fromJson', () {
    test('parses items using the supplied parser and falls back total/page/limit', () {
      final result = PaginatedIntegrationResult.fromJson(
        {
          'items': [
            {'id': 'x'},
          ],
        },
        (json) => json['id'] as String,
      );

      expect(result.items, ['x']);
      expect(result.total, 1);
      expect(result.page, 1);
      expect(result.totalPages, 1);
    });
  });

  group('IntegrationConnection', () {
    test('fromJson defaults version to 0 and lastHealthStatus to UNKNOWN', () {
      final connection = IntegrationConnection.fromJson({
        'id': 'conn-1',
        'provider': 'SLACK',
        'displayName': 'Slack',
        'authType': 'OAUTH',
        'status': 'PENDING',
        'createdAt': '2026-01-01T00:00:00.000Z',
        'updatedAt': '2026-01-01T00:00:00.000Z',
      });

      expect(connection.version, 0);
      expect(connection.lastHealthStatus, 'UNKNOWN');
      expect(connection.isConnected, isFalse);
    });

    test('isConnected is true only when status is CONNECTED', () {
      final connection = IntegrationConnection.fromJson({
        'id': 'conn-1',
        'provider': 'SLACK',
        'displayName': 'Slack',
        'authType': 'OAUTH',
        'status': 'CONNECTED',
        'createdAt': '2026-01-01T00:00:00.000Z',
        'updatedAt': '2026-01-01T00:00:00.000Z',
      });

      expect(connection.isConnected, isTrue);
    });
  });

  group('IntegrationMetrics.fromJson', () {
    test('coerces averageDurationMs from an int to a double', () {
      final metrics = IntegrationMetrics.fromJson({'averageDurationMs': 42});
      expect(metrics.averageDurationMs, 42.0);
    });

    test('defaults every count to 0 and lastHealthStatus to UNKNOWN when omitted', () {
      final metrics = IntegrationMetrics.fromJson(const {});

      expect(metrics.totalCalls, 0);
      expect(metrics.failedSyncRuns, 0);
      expect(metrics.lastHealthStatus, 'UNKNOWN');
      expect(metrics.minRateLimitRemaining, isNull);
    });
  });

  group('mapToIntegrationException', () {
    test('passes an existing IntegrationException through unchanged', () {
      const original = IntegrationException('already mapped');
      expect(mapToIntegrationException(original), same(original));
    });

    test('uses the backend message for a NetworkException with a status code', () {
      const error = NetworkException(message: 'Provider rejected the token', statusCode: 401);
      expect(mapToIntegrationException(error).message, 'Provider rejected the token');
    });

    test('uses a friendly message for a NetworkException with no status code', () {
      const error = NetworkException(message: 'boom', type: NetworkExceptionType.server);
      expect(mapToIntegrationException(error).message, contains('servers are having trouble'));
    });

    test('falls back to a generic message for any other error type', () {
      expect(
        mapToIntegrationException(StateError('boom')).message,
        'Unable to complete integration request.',
      );
    });
  });
}
