import 'package:dio/dio.dart';

import '../../storage/token_storage.dart';
import '../../../features/auth/data/constants/auth_constants.dart';
import '../../../features/auth/data/models/auth_tokens.dart';
import '../api_client.dart';

/// Attaches JWT access tokens and refreshes them on 401 responses.
class AuthInterceptor extends QueuedInterceptor {
  AuthInterceptor({
    required this.dio,
    required this.tokenStorage,
    required this.refreshDio,
  });

  final Dio dio;
  final TokenStorage tokenStorage;
  final Dio refreshDio;

  Future<AuthTokens?>? _refreshFuture;

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    if (!_isAuthEndpoint(options.path)) {
      final accessToken = await tokenStorage.readAccessToken();
      if (accessToken != null && accessToken.isNotEmpty) {
        options.headers['Authorization'] = 'Bearer $accessToken';
      }
    }
    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final shouldRetry = err.response?.statusCode == 401 &&
        err.requestOptions.extra['auth_retry'] != true &&
        !_isAuthEndpoint(err.requestOptions.path);

    if (!shouldRetry) {
      handler.next(err);
      return;
    }

    final refreshed = await _refreshTokens();
    if (refreshed == null) {
      await tokenStorage.clear();
      handler.next(err);
      return;
    }

    try {
      final requestOptions = err.requestOptions;
      requestOptions.extra['auth_retry'] = true;
      requestOptions.headers['Authorization'] = 'Bearer $refreshed.accessToken';
      final response = await dio.fetch<dynamic>(requestOptions);
      handler.resolve(response);
    } on DioException catch (retryError) {
      handler.next(retryError);
    }
  }

  Future<AuthTokens?> _refreshTokens() {
    _refreshFuture ??= _performRefresh().whenComplete(() {
      _refreshFuture = null;
    });
    return _refreshFuture!;
  }

  Future<AuthTokens?> _performRefresh() async {
    final storedRefreshToken = await tokenStorage.readRefreshToken();
    if (storedRefreshToken == null || storedRefreshToken.isEmpty) {
      return null;
    }

    try {
      final response = await refreshDio.post<Map<String, dynamic>>(
        AuthApiPaths.refresh,
        data: {'refreshToken': storedRefreshToken},
      );
      final tokens = ApiClient.unwrap<Map<String, dynamic>>(
        response.data,
        (json) => json,
      );
      final authTokens = AuthTokens.fromJson(tokens);
      await tokenStorage.saveTokens(
        accessToken: authTokens.accessToken,
        refreshToken: authTokens.refreshToken,
      );
      return authTokens;
    } on DioException {
      return null;
    }
  }

  bool _isAuthEndpoint(String path) {
    return path.contains('/auth/login') ||
        path.contains('/auth/register') ||
        path.contains('/auth/refresh');
  }
}
