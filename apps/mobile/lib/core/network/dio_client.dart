import 'package:dio/dio.dart';

import '../../config/app_config.dart';
import '../../config/env_config.dart';

/// Configures a shared [Dio] instance for the Voltx API.
class DioClient {
  const DioClient(this._env);

  final EnvConfig _env;

  Dio create() {
    final dio = Dio(
      BaseOptions(
        baseUrl: _env.apiBaseUrl,
        connectTimeout: AppConfig.connectTimeout,
        receiveTimeout: AppConfig.receiveTimeout,
        headers: const {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
      ),
    );

    if (_env.enableNetworkLogging) {
      dio.interceptors.add(
        LogInterceptor(
          requestBody: true,
          responseBody: true,
        ),
      );
    }

    return dio;
  }
}
