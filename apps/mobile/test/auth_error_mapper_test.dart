import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltx_mobile/features/auth/data/models/auth_user.dart';
import 'package:voltx_mobile/features/auth/data/services/auth_error_mapper.dart';
import 'package:voltx_mobile/core/network/network_exception.dart';

void main() {
  group('AuthErrorMapper', () {
    test('maps duplicate-email conflicts to a friendly message and actions', () {
      final presentation = AuthErrorMapper.toUiModel(
        const AuthException('Raw backend error', code: 'email_exists'),
      );

      expect(presentation.message, 'An account with this email already exists.');
      expect(presentation.actions, hasLength(2));
      expect(presentation.actions.map((action) => action.label).toList(), [
        'Sign In',
        'Use another email',
      ]);
    });

    test('maps network conflicts to the same friendly message', () {
      final presentation = AuthErrorMapper.toUiModel(
        const NetworkException(
          message: 'Conflict',
          statusCode: 409,
          type: NetworkExceptionType.server,
        ),
      );

      expect(presentation.message, 'An account with this email already exists.');
    });

    test('extracts backend conflict messages from nested error payloads', () {
      final dioException = DioException(
        requestOptions: RequestOptions(path: '/auth/register'),
        type: DioExceptionType.badResponse,
        response: Response<Map<String, dynamic>>(
          requestOptions: RequestOptions(path: '/auth/register'),
          statusCode: 409,
          data: {
            'success': false,
            'error': {
              'code': 'CONFLICT',
              'message': 'An account with this email already exists',
            },
          },
        ),
      );

      final exception = NetworkException.fromDioException(dioException);
      final presentation = AuthErrorMapper.toUiModel(exception);

      expect(exception.message, 'An account with this email already exists');
      expect(presentation.message, 'An account with this email already exists.');
    });
  });
}
