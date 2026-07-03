import 'package:flutter_test/flutter_test.dart';

import 'package:voltx_mobile/core/network/api_response.dart';

void main() {
  group('ApiResponse', () {
    test('fromJson deserializes envelope', () {
      final response = ApiResponse.fromJson(
        (json) => json as String,
        {
          'success': true,
          'data': 'hello',
          'meta': {'version': 'v1'},
        },
      );

      expect(response.success, isTrue);
      expect(response.data, 'hello');
      expect(response.meta?['version'], 'v1');
    });

    test('toJson serializes envelope', () {
      const response = ApiResponse<String>(
        success: true,
        data: 'hello',
        meta: {'version': 'v1'},
      );

      final json = response.toJson((value) => value);
      expect(json['success'], isTrue);
      expect(json['data'], 'hello');
      expect(json['meta'], {'version': 'v1'});
    });
  });
}
