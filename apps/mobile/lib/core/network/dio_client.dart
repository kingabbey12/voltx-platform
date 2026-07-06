import 'package:dio/dio.dart';

import '../../config/app_config.dart';
import '../../config/env_config.dart';
import '../storage/token_storage.dart';
import 'certificate_pinning.dart';
import 'interceptors/auth_interceptor.dart';
import 'interceptors/request_id_interceptor.dart';

/// Configures a shared [Dio] instance for the Voltx API.
class DioClient {
  DioClient(
    this._env, {
    this.tokenStorage,
    this.refreshDio,
  });

  final EnvConfig _env;
  final TokenStorage? tokenStorage;
  final Dio? refreshDio;

  Dio create({bool authenticated = false}) {
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

    applyCertificatePinning(dio, CertificatePinningConfig.fromEnvironment());

    dio.interceptors.add(RequestIdInterceptor());

    final storage = tokenStorage;
    if (authenticated && storage != null) {
      final refreshClient = refreshDio ?? dio;
      dio.interceptors.add(
        AuthInterceptor(
          dio: dio,
          tokenStorage: storage,
          refreshDio: refreshClient,
        ),
      );
    }

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
