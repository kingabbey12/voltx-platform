import 'dart:async';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltx_mobile/core/network/api_client.dart';
import 'package:voltx_mobile/features/attachments/data/models/attachment_models.dart';
import 'package:voltx_mobile/features/attachments/data/models/pending_attachment_upload.dart';
import 'package:voltx_mobile/features/attachments/data/repositories/attachment_repository.dart';
import 'package:voltx_mobile/features/attachments/data/services/attachment_api_service.dart';
import 'package:voltx_mobile/features/attachments/presentation/providers/attachment_upload_providers.dart';

RemoteAttachment _remoteAttachment({String id = 'attachment-1', AttachmentStatus status = AttachmentStatus.ready}) {
  return RemoteAttachment(
    id: id,
    fileName: 'report.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 2048,
    status: status,
    hasThumbnail: false,
  );
}

typedef UploadImpl = Future<RemoteAttachment> Function(
  File file, {
  void Function(double fraction)? onProgress,
  CancelToken? cancelToken,
});

/// Test double that never touches the network: overrides the one method
/// AttachmentUploadNotifier calls so upload/processing behavior is fully
/// controlled by each test, mirroring how apps/web's equivalent hook test
/// would stub its API layer.
class FakeAttachmentRepository extends AttachmentRepository {
  FakeAttachmentRepository() : super(AttachmentApiService(ApiClient(Dio()), Dio()));

  UploadImpl? uploadImpl;

  @override
  Future<RemoteAttachment> uploadAndWaitUntilReady(
    File file, {
    void Function(double fraction)? onProgress,
    CancelToken? cancelToken,
  }) {
    return uploadImpl!(file, onProgress: onProgress, cancelToken: cancelToken);
  }
}

void main() {
  late FakeAttachmentRepository fakeRepository;
  late ProviderContainer container;

  setUp(() {
    fakeRepository = FakeAttachmentRepository();
    container = ProviderContainer(
      overrides: [attachmentRepositoryProvider.overrideWithValue(fakeRepository)],
    );
    addTearDown(container.dispose);
    // attachmentUploadProvider is autoDispose; keep it alive across the
    // awaits in these tests the same way a real screen's Consumer would.
    container.listen(attachmentUploadProvider, (_, _) {});
  });

  group('AttachmentUploadNotifier', () {
    test('addFiles marks a new upload as uploading, then done once the repository resolves', () async {
      final completer = Completer<RemoteAttachment>();
      fakeRepository.uploadImpl = (file, {onProgress, cancelToken}) => completer.future;

      final notifier = container.read(attachmentUploadProvider.notifier);
      notifier.addFiles([File('report.pdf')]);

      var state = container.read(attachmentUploadProvider);
      expect(state, hasLength(1));
      expect(state.single.status, PendingUploadStatus.uploading);
      expect(notifier.isUploading, isTrue);
      expect(notifier.readyAttachments, isEmpty);

      completer.complete(_remoteAttachment());
      await Future<void>.delayed(Duration.zero);

      state = container.read(attachmentUploadProvider);
      expect(state.single.status, PendingUploadStatus.done);
      expect(notifier.isUploading, isFalse);
      expect(notifier.readyAttachments, hasLength(1));
      expect(notifier.readyAttachments.single.id, 'attachment-1');
    });

    test('a progress callback at fraction >= 1 flips status to processing before done resolves', () async {
      final completer = Completer<RemoteAttachment>();
      void Function(double)? capturedProgress;
      fakeRepository.uploadImpl = (file, {onProgress, cancelToken}) {
        capturedProgress = onProgress;
        return completer.future;
      };

      final notifier = container.read(attachmentUploadProvider.notifier);
      notifier.addFiles([File('photo.png')]);

      capturedProgress!(1.0);
      final state = container.read(attachmentUploadProvider);
      expect(state.single.status, PendingUploadStatus.processing);
      expect(notifier.isUploading, isTrue);

      completer.complete(_remoteAttachment());
      await Future<void>.delayed(Duration.zero);
    });

    test('a failed upload is recorded as an error with a readable message', () async {
      fakeRepository.uploadImpl = (file, {onProgress, cancelToken}) => Future.error(
            StateError('This file failed a security scan and can\'t be attached.'),
          );

      final notifier = container.read(attachmentUploadProvider.notifier);
      notifier.addFiles([File('malware.exe')]);
      await Future<void>.delayed(Duration.zero);

      final state = container.read(attachmentUploadProvider);
      expect(state.single.status, PendingUploadStatus.error);
      expect(state.single.error, contains('security scan'));
      expect(notifier.isUploading, isFalse);
    });

    test('retry re-runs the upload for the same entry and can succeed the second time', () async {
      var attempt = 0;
      fakeRepository.uploadImpl = (file, {onProgress, cancelToken}) {
        attempt += 1;
        if (attempt == 1) return Future.error(StateError('Upload failed'));
        return Future.value(_remoteAttachment());
      };

      final notifier = container.read(attachmentUploadProvider.notifier);
      notifier.addFiles([File('report.pdf')]);
      await Future<void>.delayed(Duration.zero);

      final failedLocalId = container.read(attachmentUploadProvider).single.localId;
      expect(container.read(attachmentUploadProvider).single.status, PendingUploadStatus.error);

      notifier.retry(failedLocalId);
      await Future<void>.delayed(Duration.zero);

      final state = container.read(attachmentUploadProvider);
      expect(state.single.localId, failedLocalId);
      expect(state.single.status, PendingUploadStatus.done);
      expect(attempt, 2);
    });

    test('remove drops the entry from the queue', () async {
      fakeRepository.uploadImpl = (file, {onProgress, cancelToken}) => Completer<RemoteAttachment>().future;

      final notifier = container.read(attachmentUploadProvider.notifier);
      notifier.addFiles([File('a.pdf'), File('b.pdf')]);
      expect(container.read(attachmentUploadProvider), hasLength(2));

      final firstId = container.read(attachmentUploadProvider).first.localId;
      notifier.remove(firstId);

      final state = container.read(attachmentUploadProvider);
      expect(state, hasLength(1));
      expect(state.any((u) => u.localId == firstId), isFalse);
    });

    test('reset clears the entire queue', () async {
      fakeRepository.uploadImpl = (file, {onProgress, cancelToken}) => Completer<RemoteAttachment>().future;

      final notifier = container.read(attachmentUploadProvider.notifier);
      notifier.addFiles([File('a.pdf'), File('b.pdf')]);
      expect(container.read(attachmentUploadProvider), hasLength(2));

      notifier.reset();
      expect(container.read(attachmentUploadProvider), isEmpty);
    });
  });
}
