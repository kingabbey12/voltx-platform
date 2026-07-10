import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/network/network_providers.dart';
import '../../data/models/attachment_models.dart';
import '../../data/models/pending_attachment_upload.dart';
import '../../data/repositories/attachment_repository.dart';
import '../../data/services/attachment_api_service.dart';

final attachmentApiServiceProvider = Provider<AttachmentApiService>((ref) {
  return AttachmentApiService(ref.watch(apiClientProvider), ref.watch(dioProvider));
});

final attachmentRepositoryProvider = Provider<AttachmentRepository>((ref) {
  return AttachmentRepository(ref.watch(attachmentApiServiceProvider));
});

/// Owns the client-side attachment upload queue for the AI composer,
/// mirroring apps/web/src/hooks/use-attachments.ts's useAttachmentUploads:
/// add (picker/camera all funnel here), retry, cancel, remove. Each file
/// uploads immediately on add; the composer reads [readyAttachmentIds]
/// when the user sends and clears the queue afterward.
class AttachmentUploadNotifier extends StateNotifier<List<PendingAttachmentUpload>> {
  AttachmentUploadNotifier(this._repository) : super(const []);

  final AttachmentRepository _repository;
  final Map<String, CancelToken> _cancelTokens = {};

  void addFiles(List<File> files) {
    final newUploads = files
        .map(
          (file) => PendingAttachmentUpload(
            localId: '${DateTime.now().microsecondsSinceEpoch}-${file.hashCode}',
            file: file,
            status: PendingUploadStatus.uploading,
          ),
        )
        .toList();

    state = [...state, ...newUploads];
    for (final upload in newUploads) {
      _runUpload(upload.localId, upload.file);
    }
  }

  void _runUpload(String localId, File file) {
    final cancelToken = CancelToken();
    _cancelTokens[localId] = cancelToken;

    _repository
        .uploadAndWaitUntilReady(
          file,
          onProgress: (fraction) => _updateUpload(
            localId,
            (u) => u.copyWith(
              status: fraction >= 1 ? PendingUploadStatus.processing : PendingUploadStatus.uploading,
              progress: fraction,
            ),
          ),
          cancelToken: cancelToken,
        )
        .then((attachment) {
          _updateUpload(
            localId,
            (u) => u.copyWith(status: PendingUploadStatus.done, attachment: attachment, progress: 1),
          );
        })
        .catchError((Object error) {
          if (error is DioException && error.type == DioExceptionType.cancel) {
            return; // already removed from state by cancel()/remove()
          }
          _updateUpload(
            localId,
            (u) => u.copyWith(status: PendingUploadStatus.error, error: _errorMessage(error)),
          );
        })
        .whenComplete(() => _cancelTokens.remove(localId));
  }

  String _errorMessage(Object error) {
    if (error is StateError) return error.message;
    if (error is DioException) return error.message ?? 'Upload failed';
    return 'Upload failed';
  }

  void _updateUpload(
    String localId,
    PendingAttachmentUpload Function(PendingAttachmentUpload) transform,
  ) {
    state = [
      for (final upload in state)
        if (upload.localId == localId) transform(upload) else upload,
    ];
  }

  void retry(String localId) {
    final upload = state.where((u) => u.localId == localId).firstOrNull;
    if (upload == null) return;
    _updateUpload(
      localId,
      (u) => u.copyWith(status: PendingUploadStatus.uploading, progress: 0, error: null),
    );
    _runUpload(localId, upload.file);
  }

  void remove(String localId) {
    _cancelTokens[localId]?.cancel();
    _cancelTokens.remove(localId);
    state = state.where((u) => u.localId != localId).toList();
  }

  void reset() {
    for (final token in _cancelTokens.values) {
      token.cancel();
    }
    _cancelTokens.clear();
    state = const [];
  }

  List<RemoteAttachment> get readyAttachments => state
      .where((u) => u.status == PendingUploadStatus.done && u.attachment != null)
      .map((u) => u.attachment!)
      .toList();

  bool get isUploading => state.any(
        (u) => u.status == PendingUploadStatus.uploading || u.status == PendingUploadStatus.processing,
      );
}

final attachmentUploadProvider =
    StateNotifierProvider.autoDispose<AttachmentUploadNotifier, List<PendingAttachmentUpload>>((ref) {
  return AttachmentUploadNotifier(ref.watch(attachmentRepositoryProvider));
});

/// Attachments linked to a specific AI message via AttachmentReference —
/// used to render historical messages' attachments (the backend doesn't
/// embed them in the message payload itself, same design as the web app).
final messageAttachmentsProvider =
    FutureProvider.autoDispose.family<List<RemoteAttachment>, String>((ref, messageId) {
  return ref.watch(attachmentRepositoryProvider).listByReference(
        AttachmentReferenceType.aiMessage,
        messageId,
      );
});
