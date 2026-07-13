/// Mirrors the backend's ApiErrorEnvelope shape
/// (src/common/filters/global-exception.filter.ts).
class VoltxApiError implements Exception {
  const VoltxApiError(
    this.message, {
    required this.statusCode,
    this.code,
    this.details,
  });

  final String message;
  final int? statusCode;
  final String? code;
  final Object? details;

  bool get isUnauthorized => statusCode == 401;
  bool get isForbidden => statusCode == 403;
  bool get isNotFound => statusCode == 404;
  bool get isRateLimited => statusCode == 429;
  bool get isNetworkFailure => statusCode == null;

  @override
  String toString() => 'VoltxApiError(message: $message, statusCode: $statusCode, code: $code)';
}
