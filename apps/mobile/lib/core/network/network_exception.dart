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
    if (data is! Map) {
      return null;
    }

    final map = Map<String, dynamic>.from(data);
    return _extractMessageFromMap(map);
  }

  static String? _extractMessageFromMap(Map<String, dynamic> map) {
    final message = map['message'];
    if (message is String && message.isNotEmpty) {
      return message;
    }

    if (message is List) {
      return message.map((item) => item.toString()).join(', ');
    }

    final error = map['error'];
    if (error is Map) {
      final nested = _extractMessageFromMap(Map<String, dynamic>.from(error));
      if (nested != null && nested.isNotEmpty) {
        return nested;
      }
    }

    if (map['error'] is Map && (map['error'] as Map)['message'] is String) {
      return (map['error'] as Map)['message'] as String;
    }

    if (map['detail'] is String && (map['detail'] as String).isNotEmpty) {
      return map['detail'] as String;
    }

    if (map['errors'] is Map) {
      final parts = <String>[];
      for (final entry in (map['errors'] as Map).entries) {
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

/// A safe, user-facing message for a [NetworkException] that carries no
/// real HTTP response (`statusCode == null` — connection refused, DNS
/// failure, timeout, etc.). In that case [NetworkException.message] is
/// Dio's internal exception text (e.g. "Connection refused... This
/// indicates an error which most likely cannot be solved by the
/// library"), which must never reach a user directly. When a real HTTP
/// response did come back, the backend's own message is informative and
/// should be used instead — this helper only covers the no-response case.
String friendlyNetworkFailureMessage(NetworkException error) {
  return switch (error.type) {
    NetworkExceptionType.offline => "You're offline. Check your connection and try again.",
    NetworkExceptionType.timeout => 'The request timed out. Please try again.',
    NetworkExceptionType.server =>
      'Our servers are having trouble right now. Please try again shortly.',
    NetworkExceptionType.cancelled ||
    NetworkExceptionType.unknown =>
      'Something went wrong. Please try again.',
  };
}
