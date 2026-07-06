import '../../../../core/network/api_client.dart';
import '../../../../core/network/network_exception.dart';
import '../constants/auth_constants.dart';
import '../models/auth_organization_membership.dart';
import '../models/auth_tokens.dart';
import '../models/auth_user.dart';

/// HTTP client for auth endpoints.
class AuthApiService {
  AuthApiService(this._apiClient);

  final ApiClient _apiClient;

  Future<({AuthTokens tokens, AuthUser user})> login({
    required String email,
    required String password,
  }) async {
    final data = await _apiClient.post<Map<String, dynamic>>(
      AuthApiPaths.login,
      data: {'email': email, 'password': password},
      fromJson: (json) => json,
    );
    return _parseLoginResponse(data);
  }

  Future<({AuthTokens tokens, AuthUser user})> register({
    required String email,
    required String password,
    required String firstName,
    required String lastName,
  }) async {
    final data = await _apiClient.post<Map<String, dynamic>>(
      AuthApiPaths.register,
      data: {
        'email': email,
        'password': password,
        'firstName': firstName,
        'lastName': lastName,
      },
      fromJson: (json) => json,
    );
    return _parseLoginResponse(data);
  }

  Future<AuthUser> getMe() async {
    final data = await _apiClient.get<Map<String, dynamic>>(
      AuthApiPaths.me,
      fromJson: (json) => json,
    );
    return AuthUser.fromJson(data);
  }

  Future<List<AuthOrganizationMembership>> myOrganizations() {
    return _apiClient.getList(
      AuthApiPaths.myOrganizations,
      fromJson: AuthOrganizationMembership.fromJson,
    );
  }

  Future<({AuthTokens tokens, AuthUser user})> switchOrganization({
    required String organizationId,
  }) async {
    final data = await _apiClient.post<Map<String, dynamic>>(
      AuthApiPaths.switchOrganization,
      data: {'organizationId': organizationId},
      fromJson: (json) => json,
    );
    return _parseLoginResponse(data);
  }

  Future<AuthTokens> refresh({required String refreshToken}) async {
    final data = await _apiClient.post<Map<String, dynamic>>(
      AuthApiPaths.refresh,
      data: {'refreshToken': refreshToken},
      fromJson: (json) => json,
    );
    return AuthTokens.fromJson(data);
  }

  Future<void> logout({required String refreshToken}) async {
    await _apiClient.postVoid(
      AuthApiPaths.logout,
      data: {'refreshToken': refreshToken},
    );
  }

  Future<void> requestPasswordReset({required String email}) async {
    await _apiClient.postVoid(
      AuthApiPaths.forgotPassword,
      data: {'email': email},
    );
  }

  Future<void> resetPassword({
    required String token,
    required String password,
  }) async {
    await _apiClient.postVoid(
      AuthApiPaths.resetPassword,
      data: {'token': token, 'password': password},
    );
  }

  Future<void> verifyEmail({required String token}) async {
    await _apiClient.postVoid(
      AuthApiPaths.verifyEmail,
      data: {'token': token},
    );
  }

  ({AuthTokens tokens, AuthUser user}) _parseLoginResponse(
    Map<String, dynamic> data,
  ) {
    final userJson = Map<String, dynamic>.from(data['user'] as Map);
    return (
      tokens: AuthTokens.fromJson(data),
      user: AuthUser.fromJson(userJson),
    );
  }
}

/// Maps network failures to auth-specific exceptions. [AuthErrorMapper]
/// only ever sees the [AuthException] produced here (every repository
/// method funnels its catch through this function), so every distinction
/// the UI needs to make — validation vs. rate limit vs. offline vs. server
/// error — has to survive as a `code`, not just live on the discarded
/// [NetworkException].
AuthException mapToAuthException(Object error) {
  if (error is AuthException) {
    return error;
  }

  if (error is NetworkException) {
    final code = switch (error.statusCode) {
      401 => 'invalid_credentials',
      409 => 'email_exists',
      400 => 'validation_failed',
      429 => 'rate_limited',
      _ => switch (error.type) {
          NetworkExceptionType.offline => 'offline',
          NetworkExceptionType.timeout => 'timeout',
          NetworkExceptionType.server => 'server_error',
          NetworkExceptionType.cancelled || NetworkExceptionType.unknown => null,
        },
    };
    return AuthException(error.message, code: code);
  }

  return const AuthException('Something went wrong. Please try again.');
}
