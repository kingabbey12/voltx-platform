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
      message: _extractMessage(error.response?.data) ??
          error.message ??
          'Network request failed',
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

  static String? _extractMessage(dynamic data) {
    if (data is! Map<String, dynamic>) {
      return null;
    }

    final message = data['message'];
    if (message is String && message.isNotEmpty) {
      return message;
    }

    if (message is List) {
      return message.map((item) => item.toString()).join(', ');
    }

    if (message is Map) {
      final parts = <String>[];
      for (final entry in message.entries) {
        final value = entry.value;
        if (value is List) {
          parts.addAll(value.map((item) => item.toString()));
        } else {
          parts.add(value.toString());
        }
      }
      if (parts.isNotEmpty) {
        return parts.join(', ');
      }
    }

    return null;
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
