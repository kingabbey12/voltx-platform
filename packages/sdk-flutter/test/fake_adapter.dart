import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';

class RecordedCall {
  RecordedCall(this.method, this.url, this.headers, this.body);
  final String method;
  final String url;
  final Map<String, dynamic> headers;
  final dynamic body;
}

typedef FakeHandler = ResponseBody Function(RequestOptions options);

/// A minimal fake [HttpClientAdapter] so tests never hit the network.
/// Responses come from either a fixed queue (FIFO) or a handler function
/// (for tests that need to branch on call count/path, e.g. the OAuth
/// retry-on-401 flow).
class FakeHttpClientAdapter implements HttpClientAdapter {
  FakeHttpClientAdapter({this.handler});

  final FakeHandler? handler;
  final List<ResponseBody> queue = [];
  final List<RecordedCall> calls = [];

  void queueJson(int statusCode, Object? body) {
    queue.add(_jsonResponseBody(statusCode, body));
  }

  static ResponseBody _jsonResponseBody(int statusCode, Object? body) {
    final bytes = utf8.encode(jsonEncode(body));
    return ResponseBody.fromBytes(
      bytes,
      statusCode,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    dynamic decodedBody;
    if (requestStream != null) {
      final bytes = await requestStream.expand((chunk) => chunk).toList();
      final text = utf8.decode(bytes);
      decodedBody = text.isEmpty ? null : jsonDecode(text);
    }
    calls.add(RecordedCall(options.method, options.uri.toString(), options.headers, decodedBody));

    if (handler != null) {
      return handler!(options);
    }
    return queue.removeAt(0);
  }

  @override
  void close({bool force = false}) {}
}
