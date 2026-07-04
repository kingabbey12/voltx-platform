import 'package:flutter_test/flutter_test.dart';
import 'package:voltx_mobile/features/sales/data/models/sales_models.dart';

void main() {
  group('SalesPageQuery', () {
    test('equal filter maps produce equal hashCode', () {
      final first = SalesPageQuery(
        page: 1,
        limit: 20,
        filters: {'stage': 'QUALIFICATION', 'ownerId': 'u1'},
      );

      final second = SalesPageQuery(
        page: 1,
        limit: 20,
        filters: {'ownerId': 'u1', 'stage': 'QUALIFICATION'},
      );

      expect(first, equals(second));
      expect(first.hashCode, equals(second.hashCode));
    });

    test('different filters produce different queries', () {
      final first = SalesPageQuery(filters: {'stage': 'PROPOSAL'});
      final second = SalesPageQuery(filters: {'stage': 'NEGOTIATION'});

      expect(first == second, isFalse);
    });
  });
}
