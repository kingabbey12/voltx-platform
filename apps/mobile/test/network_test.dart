import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:voltx_mobile/config/env_config.dart';
import 'package:voltx_mobile/config/environment.dart';
import 'package:voltx_mobile/core/network/dio_client.dart';
import 'package:voltx_mobile/core/network/network_exception.dart';

void main() {
  group('EnvConfig', () {
    test('defaults to development environment', () {
      final config = EnvConfig.fromEnvironment();

      expect(config.environment, AppEnvironment.development);
      expect(config.apiBaseUrl, contains('/api/v1'));
      expect(config.enableNetworkLogging, isTrue);
    });
  });

  group('DioClient', () {
    test('creates configured dio instance', () {
      const env = EnvConfig(
        environment: AppEnvironment.development,
        apiBaseUrl: 'http://localhost:3000/api/v1',
        enableNetworkLogging: false,
      );

      final dio = DioClient(env).create();

      expect(dio.options.baseUrl, env.apiBaseUrl);
      expect(dio.options.headers['Accept'], 'application/json');
      expect(
        dio.interceptors.whereType<LogInterceptor>(),
        isEmpty,
      );
    });

    test('adds logging interceptor outside production', () {
      const env = EnvConfig(
        environment: AppEnvironment.development,
        apiBaseUrl: 'http://localhost:3000/api/v1',
        enableNetworkLogging: true,
      );

      final dio = DioClient(env).create();

      expect(dio.interceptors.whereType<LogInterceptor>(), isNotEmpty);
    });
  });

  group('NetworkException', () {
    test('maps dio timeout errors', () {
      final exception = NetworkException.fromDioException(
        DioException(
          requestOptions: RequestOptions(path: '/health'),
          type: DioExceptionType.connectionTimeout,
        ),
      );

      expect(exception.type, NetworkExceptionType.timeout);
    });
  });
}
