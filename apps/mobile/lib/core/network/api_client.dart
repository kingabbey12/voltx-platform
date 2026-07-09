import 'package:dio/dio.dart';

import 'api_response.dart';
import 'network_exception.dart';

/// Typed HTTP client that unwraps the Voltx API response envelope.
class ApiClient {
  ApiClient(this._dio);

  final Dio _dio;

  Future<T> get<T>(
    String path, {
    required T Function(Map<String, dynamic> json) fromJson,
    Map<String, dynamic>? queryParameters,
  }) async {
    return _request(
      () => _dio.get<Map<String, dynamic>>(
        path,
        queryParameters: queryParameters,
      ),
      fromJson,
    );
  }

  Future<List<T>> getList<T>(
    String path, {
    required T Function(Map<String, dynamic> json) fromJson,
    Map<String, dynamic>? queryParameters,
  }) async {
    return _requestList(
      () => _dio.get<Map<String, dynamic>>(path, queryParameters: queryParameters),
      fromJson,
    );
  }

  /// Same envelope-unwrapping as [getList] but for POST endpoints whose
  /// `data` is a plain array (e.g. `/knowledge/search`) rather than a
  /// paginated `{items, total, ...}` object.
  Future<List<T>> postList<T>(
    String path, {
    required T Function(Map<String, dynamic> json) fromJson,
    Object? data,
  }) async {
    return _requestList(
      () => _dio.post<Map<String, dynamic>>(path, data: data),
      fromJson,
    );
  }

  Future<List<T>> _requestList<T>(
    Future<Response<Map<String, dynamic>>> Function() send,
    T Function(Map<String, dynamic> json) fromJson,
  ) async {
    try {
      final response = await send();
      final envelope = ApiResponse<List<dynamic>>.fromJson(
        (data) => List<dynamic>.from(data as List),
        response.data ?? <String, dynamic>{},
      );
      if (!envelope.success) {
        throw const NetworkException(
          message: 'Request failed',
          type: NetworkExceptionType.server,
        );
      }
      return envelope.data
          .map((item) => fromJson(Map<String, dynamic>.from(item as Map)))
          .toList();
    } on DioException catch (error) {
      throw NetworkException.fromDioException(error);
    } on NetworkException {
      rethrow;
    }
  }

  /// Same envelope-unwrapping as [postList] but for GET endpoints whose
  /// `data` is a plain array (e.g. `/reference/countries`) rather than a
  /// paginated `{items, total, ...}` object.
  Future<List<T>> getListPlain<T>(
    String path, {
    required T Function(Map<String, dynamic> json) fromJson,
    Map<String, dynamic>? queryParameters,
  }) async {
    return _requestList(
      () => _dio.get<Map<String, dynamic>>(path, queryParameters: queryParameters),
      fromJson,
    );
  }

  /// Same as [getListPlain] but for endpoints whose `data` array holds
  /// plain strings rather than objects (e.g. `/reference/timezones`).
  Future<List<String>> getStringList(
    String path, {
    Map<String, dynamic>? queryParameters,
  }) async {
    try {
      final response = await _dio.get<Map<String, dynamic>>(
        path,
        queryParameters: queryParameters,
      );
      final envelope = ApiResponse<List<dynamic>>.fromJson(
        (data) => List<dynamic>.from(data as List),
        response.data ?? <String, dynamic>{},
      );
      if (!envelope.success) {
        throw const NetworkException(
          message: 'Request failed',
          type: NetworkExceptionType.server,
        );
      }
      return envelope.data.map((item) => item as String).toList();
    } on DioException catch (error) {
      throw NetworkException.fromDioException(error);
    } on NetworkException {
      rethrow;
    }
  }

  Future<T> post<T>(
    String path, {
    required T Function(Map<String, dynamic> json) fromJson,
    Object? data,
  }) async {
    return _request(
      () => _dio.post<Map<String, dynamic>>(path, data: data),
      fromJson,
    );
  }

  Future<T> patch<T>(
    String path, {
    required T Function(Map<String, dynamic> json) fromJson,
    Object? data,
  }) async {
    return _request(
      () => _dio.patch<Map<String, dynamic>>(path, data: data),
      fromJson,
    );
  }

  Future<T> delete<T>(
    String path, {
    required T Function(Map<String, dynamic> json) fromJson,
  }) async {
    return _request(
      () => _dio.delete<Map<String, dynamic>>(path),
      fromJson,
    );
  }

  Future<void> postVoid(String path, {Object? data}) async {
    try {
      await _dio.post<void>(path, data: data);
    } on DioException catch (error) {
      throw NetworkException.fromDioException(error);
    }
  }

  Future<T> _request<T>(
    Future<Response<Map<String, dynamic>>> Function() send,
    T Function(Map<String, dynamic> json) fromJson,
  ) async {
    try {
      final response = await send();
      return unwrap(response.data, fromJson);
    } on DioException catch (error) {
      throw NetworkException.fromDioException(error);
    } on NetworkException {
      rethrow;
    }
  }

  static T unwrap<T>(
    Map<String, dynamic>? json,
    T Function(Map<String, dynamic> json) fromJson,
  ) {
    if (json == null) {
      throw const NetworkException(message: 'Empty response from server');
    }

    final envelope = ApiResponse<Map<String, dynamic>>.fromJson(
      (data) => Map<String, dynamic>.from(data as Map),
      json,
    );

    if (!envelope.success) {
      throw const NetworkException(
        message: 'Request failed',
        type: NetworkExceptionType.server,
      );
    }

    return fromJson(envelope.data);
  }
}
