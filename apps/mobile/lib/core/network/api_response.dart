import 'package:freezed_annotation/freezed_annotation.dart';

part 'api_response.freezed.dart';
part 'api_response.g.dart';

/// Standard API envelope used by the Voltx backend.
@Freezed(genericArgumentFactories: true)
abstract class ApiResponse<T> with _$ApiResponse<T> {
  const factory ApiResponse({
    required bool success,
    required T data,
    Map<String, dynamic>? meta,
  }) = _ApiResponse<T>;

  factory ApiResponse.fromJson(
    T Function(Object? json) fromJsonT,
    Map<String, dynamic> json,
  ) =>
      _$ApiResponseFromJson(json, fromJsonT);
}
