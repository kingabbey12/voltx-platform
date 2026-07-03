import 'package:dio/dio.dart';

import '../constants/auth_constants.dart';

/// HTTP client surface for auth endpoints.
///
/// Methods are prepared for backend integration but not wired yet.
/// Use [MockAuthRepository] until the API is connected.
class AuthApiService {
  AuthApiService(this._dio);

  final Dio _dio;

  Dio get client => _dio;

  Future<Map<String, dynamic>> login({
    required String email,
    required String password,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      AuthApiPaths.login,
      data: {'email': email, 'password': password},
    );
    return response.data ?? {};
  }

  Future<Map<String, dynamic>> register({
    required String email,
    required String password,
    required String firstName,
    required String lastName,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      AuthApiPaths.register,
      data: {
        'email': email,
        'password': password,
        'firstName': firstName,
        'lastName': lastName,
      },
    );
    return response.data ?? {};
  }

  Future<void> requestPasswordReset({required String email}) async {
    await _dio.post<void>(
      AuthApiPaths.forgotPassword,
      data: {'email': email},
    );
  }

  Future<void> resetPassword({
    required String token,
    required String password,
  }) async {
    await _dio.post<void>(
      AuthApiPaths.resetPassword,
      data: {'token': token, 'password': password},
    );
  }

  Future<void> verifyEmail({required String token}) async {
    await _dio.post<void>(
      AuthApiPaths.verifyEmail,
      data: {'token': token},
    );
  }
}
