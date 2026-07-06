import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';

import 'network_exception.dart';

/// One parsed Server-Sent Event frame. Mirrors the backend's
/// `formatSseEvent` wire format exactly: `id: SEQ`, `event: TYPE`, `data:
/// JSON`, each on its own line, frames separated by a blank line.
/// `heartbeat` frames are filtered out before reaching consumers;
/// `done`/`error` are terminal and end the stream (the latter by
/// throwing).
class SseEvent {
  const SseEvent({required this.event, required this.data});

  final String event;
  final Map<String, dynamic> data;
}

/// Thrown when the backend writes a terminal `event: error` frame.
class SseStreamException implements Exception {
  const SseStreamException(this.code, this.message);

  final String code;
  final String message;

  @override
  String toString() => 'SseStreamException($code): $message';
}

/// Consumes a `text/event-stream` POST endpoint (workflow run/resume,
/// knowledge preview/ingestion, AI chat/agent streaming) — the one
/// implementation every streaming feature in the app shares, since Dio has
/// no built-in SSE support. Reads the raw byte stream via
/// `ResponseType.stream`, buffers on `\n\n` frame boundaries, and yields
/// one [SseEvent] per frame (heartbeats swallowed, `done` ends the stream
/// cleanly, `error` throws [SseStreamException]).
class SseClient {
  SseClient(this._dio);

  final Dio _dio;

  Stream<SseEvent> post(
    String path, {
    Object? data,
    CancelToken? cancelToken,
  }) {
    final controller = StreamController<SseEvent>();

    unawaited(_run(path, data, cancelToken, controller));

    return controller.stream;
  }

  Future<void> _run(
    String path,
    Object? data,
    CancelToken? cancelToken,
    StreamController<SseEvent> controller,
  ) async {
    try {
      final response = await _dio.post<ResponseBody>(
        path,
        data: data,
        cancelToken: cancelToken,
        options: Options(
          responseType: ResponseType.stream,
          headers: const {'Accept': 'text/event-stream'},
        ),
      );

      final body = response.data;
      if (body == null) {
        throw const NetworkException(message: 'Empty stream response from server');
      }

      var buffer = '';
      await for (final chunk in body.stream) {
        buffer += utf8.decode(chunk, allowMalformed: true);

        while (true) {
          final boundary = buffer.indexOf('\n\n');
          if (boundary == -1) {
            break;
          }
          final rawFrame = buffer.substring(0, boundary);
          buffer = buffer.substring(boundary + 2);

          final frame = _parseFrame(rawFrame);
          if (frame == null || frame.event == 'heartbeat') {
            continue;
          }
          if (frame.event == 'done') {
            await controller.close();
            return;
          }
          if (frame.event == 'error') {
            final code = frame.data['code'] as String? ?? 'StreamError';
            final message = frame.data['message'] as String? ?? 'Event stream failed';
            throw SseStreamException(code, message);
          }
          controller.add(frame);
        }
      }
      await controller.close();
    } on DioException catch (error) {
      controller.addError(NetworkException.fromDioException(error));
      await controller.close();
    } catch (error) {
      controller.addError(error);
      await controller.close();
    }
  }

  static SseEvent? _parseFrame(String rawFrame) {
    String? eventName;
    final dataLines = <String>[];

    for (final line in rawFrame.split('\n')) {
      if (line.startsWith('event:')) {
        eventName = line.substring('event:'.length).trim();
      } else if (line.startsWith('data:')) {
        dataLines.add(line.substring('data:'.length).trimLeft());
      }
    }

    if (eventName == null || dataLines.isEmpty) {
      return null;
    }

    final rawData = dataLines.join('\n');
    final decoded = jsonDecode(rawData);
    return SseEvent(
      event: eventName,
      data: decoded is Map<String, dynamic> ? decoded : <String, dynamic>{},
    );
  }
}
