import 'dart:async';
import 'dart:io';

import 'package:dio/dio.dart';

import '../models/attachment_models.dart';
import '../services/attachment_api_service.dart';

const _processingPollInterval = Duration(milliseconds: 800);
const _processingPollTimeout = Duration(seconds: 30);

/// Coordinates a single file's upload + backend processing wait: the
/// upload HTTP call resolving only means bytes were transferred, not that
/// the file is ready for AI use — the backend still runs virus-scan/
/// thumbnail/text-extraction afterward. [uploadAndWaitUntilReady] hides
/// that two-phase reality behind one call that only resolves once the
/// attachment is genuinely usable (or throws if it failed/was
/// quarantined), matching the same race-condition fix applied on web
/// (see apps/web/src/hooks/use-attachments.ts).
class AttachmentRepository {
  AttachmentRepository(this._apiService);

  final AttachmentApiService _apiService;

  Future<RemoteAttachment> uploadAndWaitUntilReady(
    File file, {
    void Function(double fraction)? onProgress,
    CancelToken? cancelToken,
  }) async {
    final uploaded = await _apiService.uploadFile(
      file,
      onSendProgress: (sent, total) {
        if (total > 0) {
          onProgress?.call(sent / total);
        }
      },
      cancelToken: cancelToken,
    );

    return _pollUntilProcessed(uploaded.id, cancelToken: cancelToken);
  }

  Future<RemoteAttachment> _pollUntilProcessed(
    String attachmentId, {
    CancelToken? cancelToken,
  }) async {
    final deadline = DateTime.now().add(_processingPollTimeout);

    while (true) {
      if (cancelToken?.isCancelled ?? false) {
        throw StateError('Upload cancelled');
      }

      final attachment = await _apiService.getAttachment(attachmentId);

      if (attachment.status == AttachmentStatus.ready) {
        return attachment;
      }
      if (attachment.status == AttachmentStatus.quarantined) {
        throw StateError('This file failed a security scan and can\'t be attached.');
      }
      if (attachment.status == AttachmentStatus.failed) {
        throw StateError('Processing this file failed.');
      }
      if (DateTime.now().isAfter(deadline)) {
        throw StateError('Timed out waiting for the file to finish processing.');
      }

      await Future<void>.delayed(_processingPollInterval);
    }
  }

  Future<void> addReference(
    String attachmentId,
    AttachmentReferenceType referenceType,
    String referenceId,
  ) {
    return _apiService.addReference(attachmentId, referenceType, referenceId);
  }

  Future<List<RemoteAttachment>> listByReference(
    AttachmentReferenceType referenceType,
    String referenceId,
  ) {
    return _apiService.listByReference(referenceType, referenceId);
  }

  Future<List<int>> downloadThumbnail(String attachmentId) {
    return _apiService.downloadBytes(attachmentId, thumbnail: true);
  }

  Future<List<int>> downloadFile(String attachmentId) {
    return _apiService.downloadBytes(attachmentId);
  }

  Future<void> deleteAttachment(String id) {
    return _apiService.deleteAttachment(id);
  }
}
