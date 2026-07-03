import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:voltx_mobile/core/network/api_client.dart';
import 'package:voltx_mobile/core/network/network_exception.dart';
import 'package:voltx_mobile/features/auth/data/models/auth_tokens.dart';
import 'package:voltx_mobile/features/auth/data/models/auth_user.dart';

void main() {
  group('ApiClient', () {
    test('unwrap parses success envelope', () {
      final user = ApiClient.unwrap<AuthUser>(
        {
          'success': true,
          'data': {
            'id': 'user-1',
            'email': 'user@voltx.io',
            'firstName': 'Voltx',
            'lastName': 'User',
            'emailVerifiedAt': '2026-07-03T00:00:00.000Z',
          },
        },
        AuthUser.fromJson,
      );

      expect(user.id, 'user-1');
      expect(user.emailVerified, isTrue);
    });

    test('unwrap throws for unsuccessful envelope', () {
      expect(
        () => ApiClient.unwrap<Map<String, dynamic>>(
          {'success': false, 'data': {}},
          (json) => json,
        ),
        throwsA(isA<NetworkException>()),
      );
    });
  });

  group('AuthTokens', () {
    test('fromJson maps token fields', () {
      final tokens = AuthTokens.fromJson({
        'accessToken': 'access',
        'refreshToken': 'refresh',
        'tokenType': 'Bearer',
        'expiresIn': 900,
      });

      expect(tokens.accessToken, 'access');
      expect(tokens.refreshToken, 'refresh');
      expect(tokens.expiresIn, 900);
    });
  });

  group('NetworkException message extraction', () {
    test('maps validation array messages', () {
      final exception = NetworkException.fromDioException(
        DioException(
          requestOptions: RequestOptions(path: '/auth/login'),
          response: Response(
            requestOptions: RequestOptions(path: '/auth/login'),
            statusCode: 400,
            data: {
              'message': ['email must be an email', 'password is too short'],
            },
          ),
          type: DioExceptionType.badResponse,
        ),
      );

      expect(
        exception.message,
        'email must be an email, password is too short',
      );
    });
  });
}
