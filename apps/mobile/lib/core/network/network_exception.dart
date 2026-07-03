import 'package:dio/dio.dart';

/// Normalized HTTP/network failure for the foundation network layer.
class NetworkException implements Exception {
  const NetworkException({
    required this.message,
    this.statusCode,
    this.type = NetworkExceptionType.unknown,
  });

  factory NetworkException.fromDioException(DioException error) {
    return NetworkException(
      message: error.message ?? 'Network request failed',
      statusCode: error.response?.statusCode,
      type: switch (error.type) {
        DioExceptionType.connectionTimeout ||
        DioExceptionType.sendTimeout ||
        DioExceptionType.receiveTimeout =>
          NetworkExceptionType.timeout,
        DioExceptionType.connectionError => NetworkExceptionType.offline,
        DioExceptionType.badResponse => NetworkExceptionType.server,
        DioExceptionType.cancel => NetworkExceptionType.cancelled,
        _ => NetworkExceptionType.unknown,
      },
    );
  }

  final String message;
  final int? statusCode;
  final NetworkExceptionType type;

  @override
  String toString() => 'NetworkException($type, $statusCode): $message';
}

enum NetworkExceptionType {
  offline,
  timeout,
  server,
  cancelled,
  unknown,
}
