import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';
import 'package:voltx_mobile/features/attachments/data/models/attachment_models.dart';
import 'package:voltx_mobile/features/attachments/data/models/pending_attachment_upload.dart';
import 'package:voltx_mobile/features/attachments/presentation/widgets/attachment_picker_ui.dart';
import 'package:voltx_mobile/theme/app_theme.dart';

RemoteAttachment _remoteAttachment({bool hasThumbnail = false}) {
  return RemoteAttachment(
    id: 'attachment-1',
    fileName: 'report.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 3 * 1024,
    status: AttachmentStatus.ready,
    hasThumbnail: hasThumbnail,
  );
}

Widget _harness(Widget child) {
  return ProviderScope(
    child: MaterialApp(theme: AppTheme.light(), home: Scaffold(body: child)),
  );
}

void main() {
  testWidgets('renders nothing when there are no uploads', (tester) async {
    await tester.pumpWidget(
      _harness(
        AttachmentPickerUi(uploads: const [], onRetry: (_) {}, onRemove: (_) {}),
      ),
    );

    expect(find.byType(SizedBox), findsWidgets);
    expect(find.byIcon(Icons.close_rounded), findsNothing);
  });

  testWidgets('shows a progress indicator and file name while uploading', (tester) async {
    final upload = PendingAttachmentUpload(
      localId: 'local-1',
      file: File('report.pdf'),
      status: PendingUploadStatus.uploading,
      progress: 0.4,
    );

    await tester.pumpWidget(
      _harness(
        AttachmentPickerUi(uploads: [upload], onRetry: (_) {}, onRemove: (_) {}),
      ),
    );

    expect(find.text('report.pdf'), findsOneWidget);
    expect(find.byType(LinearProgressIndicator), findsOneWidget);
    expect(find.byIcon(Icons.refresh_rounded), findsNothing);
  });

  testWidgets('shows "Processing..." while the backend finishes scanning/extracting', (tester) async {
    final upload = PendingAttachmentUpload(
      localId: 'local-1',
      file: File('report.pdf'),
      status: PendingUploadStatus.processing,
      progress: 1,
    );

    await tester.pumpWidget(
      _harness(
        AttachmentPickerUi(uploads: [upload], onRetry: (_) {}, onRemove: (_) {}),
      ),
    );

    expect(find.text('Processing...'), findsOneWidget);
  });

  testWidgets('shows the error message and a retry button that invokes onRetry', (tester) async {
    final upload = PendingAttachmentUpload(
      localId: 'local-1',
      file: File('malware.exe'),
      status: PendingUploadStatus.error,
      error: 'Upload failed',
    );

    String? retriedLocalId;
    await tester.pumpWidget(
      _harness(
        AttachmentPickerUi(
          uploads: [upload],
          onRetry: (id) => retriedLocalId = id,
          onRemove: (_) {},
        ),
      ),
    );

    expect(find.text('Upload failed'), findsOneWidget);
    expect(find.byIcon(Icons.refresh_rounded), findsOneWidget);

    await tester.tap(find.byIcon(Icons.refresh_rounded));
    expect(retriedLocalId, 'local-1');
  });

  testWidgets('shows the formatted file size once done and invokes onRemove', (tester) async {
    final upload = PendingAttachmentUpload(
      localId: 'local-1',
      file: File('report.pdf'),
      status: PendingUploadStatus.done,
      progress: 1,
      attachment: _remoteAttachment(),
    );

    String? removedLocalId;
    await tester.pumpWidget(
      _harness(
        AttachmentPickerUi(
          uploads: [upload],
          onRetry: (_) {},
          onRemove: (id) => removedLocalId = id,
        ),
      ),
    );

    expect(find.text('3.0 KB'), findsOneWidget);

    await tester.tap(find.byIcon(Icons.close_rounded));
    expect(removedLocalId, 'local-1');
  });

  testWidgets('renders multiple uploads in a horizontal list', (tester) async {
    final uploads = [
      PendingAttachmentUpload(localId: 'a', file: File('a.pdf'), status: PendingUploadStatus.uploading),
      PendingAttachmentUpload(localId: 'b', file: File('b.png'), status: PendingUploadStatus.done, attachment: _remoteAttachment()),
    ];

    await tester.pumpWidget(
      _harness(
        AttachmentPickerUi(uploads: uploads, onRetry: (_) {}, onRemove: (_) {}),
      ),
    );

    expect(find.text('a.pdf'), findsOneWidget);
    expect(find.text('b.png'), findsOneWidget);
    expect(find.byIcon(Icons.close_rounded), findsNWidgets(2));
  });
}
