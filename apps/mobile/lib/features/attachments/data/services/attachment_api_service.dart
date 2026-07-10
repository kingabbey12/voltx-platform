import 'dart:io';

import 'package:dio/dio.dart';
import 'package:mime/mime.dart';

import '../../../../core/network/api_client.dart';
import '../models/attachment_models.dart';

/// Real multipart upload against the backend attachments API — no
/// simulation. Uses Dio's FormData/MultipartFile directly rather than
/// [ApiClient]'s JSON-only helpers, since file upload needs a different
/// request encoding; response envelope unwrapping still goes through
/// [ApiClient.unwrap] so error handling stays consistent with the rest
/// of the app.
class AttachmentApiService {
  AttachmentApiService(this._apiClient, this._dio);

  final ApiClient _apiClient;
  final Dio _dio;

  Future<RemoteAttachment> uploadFile(
    File file, {
    void Function(int sent, int total)? onSendProgress,
    CancelToken? cancelToken,
  }) async {
    final mimeType = lookupMimeType(file.path) ?? 'application/octet-stream';
    final fileName = file.uri.pathSegments.last;

    final formData = FormData.fromMap({
      'file': await MultipartFile.fromFile(
        file.path,
        filename: fileName,
        contentType: DioMediaType.parse(mimeType),
      ),
    });

    final response = await _dio.post<Map<String, dynamic>>(
      '/attachments/upload',
      data: formData,
      onSendProgress: onSendProgress,
      cancelToken: cancelToken,
    );

    return ApiClient.unwrap(response.data, RemoteAttachment.fromJson);
  }

  Future<RemoteAttachment> getAttachment(String id) {
    return _apiClient.get('/attachments/$id', fromJson: RemoteAttachment.fromJson);
  }

  Future<List<RemoteAttachment>> listByReference(
    AttachmentReferenceType referenceType,
    String referenceId,
  ) {
    return _apiClient.get(
      '/attachments',
      queryParameters: {
        'referenceType': referenceType.wireValue,
        'referenceId': referenceId,
        'limit': 100,
      },
      fromJson: (json) => (json['items'] as List<dynamic>? ?? const [])
          .map((item) => RemoteAttachment.fromJson(Map<String, dynamic>.from(item as Map)))
          .toList(),
    );
  }

  Future<void> addReference(
    String attachmentId,
    AttachmentReferenceType referenceType,
    String referenceId,
  ) {
    return _apiClient.postVoid(
      '/attachments/$attachmentId/references',
      data: {'referenceType': referenceType.wireValue, 'referenceId': referenceId},
    );
  }

  Future<void> deleteAttachment(String id) {
    return _apiClient.delete(
      '/attachments/$id',
      fromJson: (json) => json,
    );
  }

  /// Downloads the file (or its thumbnail) as raw bytes for local preview
  /// / save-to-device — authenticated via the shared Dio instance's auth
  /// interceptor, same as every other request.
  Future<List<int>> downloadBytes(String attachmentId, {bool thumbnail = false}) async {
    final path = thumbnail
        ? '/attachments/$attachmentId/thumbnail'
        : '/attachments/$attachmentId/download';
    final response = await _dio.get<List<int>>(
      path,
      options: Options(responseType: ResponseType.bytes),
    );
    return response.data ?? const [];
  }
}
