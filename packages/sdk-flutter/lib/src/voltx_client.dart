import 'package:dio/dio.dart';

import 'models/oauth_token_response.dart';
import 'resources/oauth_applications_resource.dart';
import 'resources/personal_access_tokens_resource.dart';
import 'resources/service_accounts_resource.dart';
import 'resources/webhook_endpoints_resource.dart';
import 'voltx_api_error.dart';
import 'voltx_auth.dart';

/// Voltx API client — mirrors apps/mobile/lib/core/network/api_client.dart's
/// envelope-unwrapping/Dio-based pattern as a standalone package, generalized
/// with the full set of Developer Platform auth modes (see [VoltxAuth]).
class VoltxClient {
  VoltxClient({
    required String baseUrl,
    required this.auth,
    Dio? dio,
  }) : _dio = dio ?? Dio(BaseOptions(baseUrl: baseUrl, validateStatus: (_) => true));

  final Dio _dio;
  VoltxAuth auth;

  late final personalAccessTokens = PersonalAccessTokensResource(this);
  late final serviceAccounts = ServiceAccountsResource(this);
  late final oauthApplications = OAuthApplicationsResource(this);
  late final webhookEndpoints = WebhookEndpointsResource(this);

  Map<String, String> _authHeaders() {
    final currentAuth = auth;
    return switch (currentAuth) {
      ApiKeyAuth() => {'X-Api-Key': currentAuth.apiKey},
      PersonalAccessTokenAuth() => {
          'X-Personal-Access-Token': currentAuth.token,
          'X-Organization-Id': currentAuth.organizationId,
        },
      ServiceAccountTokenAuth() => {'X-Service-Account-Token': currentAuth.token},
      OAuthAuth() => {'Authorization': 'Bearer ${currentAuth.accessToken}'},
    };
  }

  Future<void> _refreshOAuthAccessToken() async {
    final currentAuth = auth;
    if (currentAuth is! OAuthAuth ||
        currentAuth.refreshToken == null ||
        currentAuth.clientId == null ||
        currentAuth.clientSecret == null) {
      throw const VoltxApiError(
        'Cannot refresh: auth mode is not OAuthAuth, or refreshToken/clientId/clientSecret is missing',
        statusCode: 401,
      );
    }

    final response = await _dio.post<Map<String, dynamic>>(
      '/oauth/token',
      data: {
        'grant_type': 'refresh_token',
        'refresh_token': currentAuth.refreshToken,
        'client_id': currentAuth.clientId,
        'client_secret': currentAuth.clientSecret,
      },
    );
    final body = response.data ?? <String, dynamic>{};
    if (response.statusCode == null || response.statusCode! >= 300 || body['access_token'] == null) {
      throw VoltxApiError(
        body['error_description'] as String? ?? 'OAuth token refresh failed',
        statusCode: response.statusCode,
        code: body['error'] as String?,
      );
    }

    final tokens = OAuthTokenResponse.fromJson(body);
    currentAuth.accessToken = tokens.accessToken;
    currentAuth.refreshToken = tokens.refreshToken;
    currentAuth.onTokensRefreshed?.call(tokens);
  }

  /// Used for the three raw RFC 6749/7009/7662 OAuth endpoints, which
  /// return un-enveloped JSON rather than {success,data,meta}.
  Future<Map<String, dynamic>> rawRequest(
    String path, {
    String method = 'GET',
    Object? body,
    Map<String, dynamic>? query,
  }) async {
    final response = await _dio.request<Map<String, dynamic>>(
      path,
      data: body,
      queryParameters: query,
      options: Options(method: method),
    );
    final json = response.data ?? <String, dynamic>{};
    if (response.statusCode == null || response.statusCode! >= 300) {
      throw VoltxApiError(
        json['error_description'] as String? ?? 'Request failed',
        statusCode: response.statusCode,
        code: json['error'] as String?,
      );
    }
    return json;
  }

  Future<T> request<T>(
    String path, {
    String method = 'GET',
    Object? body,
    Map<String, dynamic>? query,
    required T Function(Map<String, dynamic> json) fromJson,
    bool isRetry = false,
  }) async {
    Response<Map<String, dynamic>> response;
    try {
      response = await _dio.request<Map<String, dynamic>>(
        path,
        data: body,
        queryParameters: query,
        options: Options(method: method, headers: _authHeaders()),
      );
    } on DioException catch (error) {
      throw VoltxApiError(error.message ?? 'Network request failed', statusCode: null);
    }

    final json = response.data;
    final statusOk = response.statusCode != null && response.statusCode! < 300;

    if (statusOk && json != null && json['success'] == true) {
      return fromJson(Map<String, dynamic>.from(json['data'] as Map));
    }

    final currentAuth = auth;
    if (response.statusCode == 401 &&
        currentAuth is OAuthAuth &&
        currentAuth.refreshToken != null &&
        !isRetry) {
      await _refreshOAuthAccessToken();
      return request<T>(path, method: method, body: body, query: query, fromJson: fromJson, isRetry: true);
    }

    final errorEnvelope = (json != null && json['success'] == false) ? json['error'] as Map? : null;
    throw VoltxApiError(
      errorEnvelope?['message'] as String? ?? 'Request failed with status ${response.statusCode}',
      statusCode: response.statusCode,
      code: errorEnvelope?['code'] as String?,
      details: errorEnvelope?['details'],
    );
  }

  /// Same envelope-unwrapping as [request] but for endpoints whose `data`
  /// is a plain JSON array (e.g. list endpoints), not a single object.
  Future<List<T>> requestList<T>(
    String path, {
    String method = 'GET',
    Object? body,
    Map<String, dynamic>? query,
    required T Function(Map<String, dynamic> json) fromJson,
    bool isRetry = false,
  }) async {
    Response<Map<String, dynamic>> response;
    try {
      response = await _dio.request<Map<String, dynamic>>(
        path,
        data: body,
        queryParameters: query,
        options: Options(method: method, headers: _authHeaders()),
      );
    } on DioException catch (error) {
      throw VoltxApiError(error.message ?? 'Network request failed', statusCode: null);
    }

    final json = response.data;
    final statusOk = response.statusCode != null && response.statusCode! < 300;

    if (statusOk && json != null && json['success'] == true) {
      return (json['data'] as List)
          .map((item) => fromJson(Map<String, dynamic>.from(item as Map)))
          .toList();
    }

    final currentAuth = auth;
    if (response.statusCode == 401 &&
        currentAuth is OAuthAuth &&
        currentAuth.refreshToken != null &&
        !isRetry) {
      await _refreshOAuthAccessToken();
      return requestList<T>(
        path,
        method: method,
        body: body,
        query: query,
        fromJson: fromJson,
        isRetry: true,
      );
    }

    final errorEnvelope = (json != null && json['success'] == false) ? json['error'] as Map? : null;
    throw VoltxApiError(
      errorEnvelope?['message'] as String? ?? 'Request failed with status ${response.statusCode}',
      statusCode: response.statusCode,
      code: errorEnvelope?['code'] as String?,
      details: errorEnvelope?['details'],
    );
  }

  Future<void> requestVoid(String path, {String method = 'DELETE'}) async {
    Response<Map<String, dynamic>> response;
    try {
      response = await _dio.request<Map<String, dynamic>>(
        path,
        options: Options(method: method, headers: _authHeaders()),
      );
    } on DioException catch (error) {
      throw VoltxApiError(error.message ?? 'Network request failed', statusCode: null);
    }
    if (response.statusCode == null || response.statusCode! >= 300) {
      final json = response.data;
      final errorEnvelope = (json != null && json['success'] == false) ? json['error'] as Map? : null;
      throw VoltxApiError(
        errorEnvelope?['message'] as String? ?? 'Request failed with status ${response.statusCode}',
        statusCode: response.statusCode,
        code: errorEnvelope?['code'] as String?,
      );
    }
  }
}
