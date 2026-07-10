import 'dart:io';

import 'attachment_models.dart';

enum PendingUploadStatus { uploading, processing, done, error }

/// Client-side upload queue entry — tracks one file from picker-selection
/// through upload through backend processing. Distinct from
/// [RemoteAttachment], which only exists once the server has accepted
/// the file.
class PendingAttachmentUpload {
  const PendingAttachmentUpload({
    required this.localId,
    required this.file,
    required this.status,
    this.progress = 0,
    this.attachment,
    this.error,
  });

  final String localId;
  final File file;
  final PendingUploadStatus status;
  final double progress;
  final RemoteAttachment? attachment;
  final String? error;

  String get fileName => file.uri.pathSegments.last;

  PendingAttachmentUpload copyWith({
    PendingUploadStatus? status,
    double? progress,
    RemoteAttachment? attachment,
    String? error,
  }) {
    return PendingAttachmentUpload(
      localId: localId,
      file: file,
      status: status ?? this.status,
      progress: progress ?? this.progress,
      attachment: attachment ?? this.attachment,
      error: error,
    );
  }
}
