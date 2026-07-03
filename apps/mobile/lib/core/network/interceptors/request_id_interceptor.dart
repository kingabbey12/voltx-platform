import 'package:dio/dio.dart';

import '../request_id.dart';

/// Adds an `x-request-id` header to every outgoing request.
class RequestIdInterceptor extends Interceptor {
  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    options.headers.putIfAbsent('x-request-id', generateRequestId);
    handler.next(options);
  }
}
