import 'dart:io';

import 'package:file_picker/file_picker.dart' as fp;
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';

import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';
import '../../data/models/pending_attachment_upload.dart';
import 'attachment_thumbnail.dart';

/// Real file/image attachment picker: camera, gallery, and files, each
/// backed by the platform picker packages (image_picker, file_picker) —
/// replaces the previous version, which silently inserted hardcoded fake
/// files regardless of what the user tapped.
class AttachmentPickerUi extends StatelessWidget {
  const AttachmentPickerUi({
    required this.uploads,
    required this.onRetry,
    required this.onRemove,
    super.key,
  });

  final List<PendingAttachmentUpload> uploads;
  final ValueChanged<String> onRetry;
  final ValueChanged<String> onRemove;

  static Widget addButtons({required ValueChanged<List<File>> onFilesSelected}) {
    return _AttachmentAddButtons(onFilesSelected: onFilesSelected);
  }

  @override
  Widget build(BuildContext context) {
    if (uploads.isEmpty) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.xs),
      child: SizedBox(
        height: 64,
        child: ListView.separated(
          scrollDirection: Axis.horizontal,
          itemCount: uploads.length,
          separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.xs),
          itemBuilder: (context, index) {
            final upload = uploads[index];
            return _UploadChip(
              upload: upload,
              onRetry: () => onRetry(upload.localId),
              onRemove: () => onRemove(upload.localId),
            );
          },
        ),
      ),
    );
  }
}

class _AttachmentAddButtons extends StatelessWidget {
  const _AttachmentAddButtons({required this.onFilesSelected});

  final ValueChanged<List<File>> onFilesSelected;

  Future<void> _pickFromCamera(BuildContext context) async {
    final picker = ImagePicker();
    final photo = await picker.pickImage(source: ImageSource.camera, imageQuality: 90);
    if (photo != null) {
      onFilesSelected([File(photo.path)]);
    }
  }

  Future<void> _pickFromGallery(BuildContext context) async {
    final picker = ImagePicker();
    final photos = await picker.pickMultiImage(imageQuality: 90);
    if (photos.isNotEmpty) {
      onFilesSelected(photos.map((p) => File(p.path)).toList());
    }
  }

  Future<void> _pickFiles(BuildContext context) async {
    final result = await fp.FilePicker.platform.pickFiles(
      allowMultiple: true,
      type: fp.FileType.custom,
      allowedExtensions: const [
        'pdf',
        'doc',
        'docx',
        'xls',
        'xlsx',
        'ppt',
        'pptx',
        'txt',
        'md',
        'csv',
        'json',
        'jpg',
        'jpeg',
        'png',
        'gif',
        'webp',
        'heic',
      ],
    );
    final paths = result?.files.map((f) => f.path).whereType<String>().toList() ?? const [];
    if (paths.isNotEmpty) {
      onFilesSelected(paths.map(File.new).toList());
    }
  }

  void _showPickerSheet(BuildContext context) {
    showModalBottomSheet<void>(
      context: context,
      builder: (sheetContext) => SafeArea(
        child: Wrap(
          children: [
            ListTile(
              leading: const Icon(Icons.photo_camera_outlined),
              title: const Text('Camera'),
              onTap: () {
                Navigator.of(sheetContext).pop();
                _pickFromCamera(context);
              },
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_outlined),
              title: const Text('Photo gallery'),
              onTap: () {
                Navigator.of(sheetContext).pop();
                _pickFromGallery(context);
              },
            ),
            ListTile(
              leading: const Icon(Icons.insert_drive_file_outlined),
              title: const Text('Files'),
              onTap: () {
                Navigator.of(sheetContext).pop();
                _pickFiles(context);
              },
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return IconButton(
      icon: const Icon(Icons.attach_file_rounded),
      tooltip: 'Attach files',
      onPressed: () => _showPickerSheet(context),
    );
  }
}

class _UploadChip extends StatelessWidget {
  const _UploadChip({required this.upload, required this.onRetry, required this.onRemove});

  final PendingAttachmentUpload upload;
  final VoidCallback onRetry;
  final VoidCallback onRemove;

  @override
  Widget build(BuildContext context) {
    final colors = context.voltxColors;
    final isImage = upload.attachment?.isImage ??
        _looksLikeImagePath(upload.file.path);

    return Container(
      width: 200,
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs, vertical: 6),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(10),
        color: colors.surfaceMuted,
        border: Border.all(color: colors.borderSubtle),
      ),
      child: Row(
        children: [
          SizedBox(
            width: 40,
            height: 40,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: upload.attachment != null && upload.attachment!.hasThumbnail
                  ? AttachmentThumbnail(attachmentId: upload.attachment!.id)
                  : Container(
                      color: colors.surfaceMuted,
                      child: Icon(
                        isImage ? Icons.image_outlined : Icons.insert_drive_file_outlined,
                        size: 18,
                        color: colors.borderSubtle,
                      ),
                    ),
            ),
          ),
          const SizedBox(width: AppSpacing.xs),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  upload.fileName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.labelSmall,
                ),
                const SizedBox(height: 2),
                _StatusLine(upload: upload),
              ],
            ),
          ),
          if (upload.status == PendingUploadStatus.error)
            IconButton(
              icon: const Icon(Icons.refresh_rounded, size: 16),
              onPressed: onRetry,
              tooltip: 'Retry upload',
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
            ),
          IconButton(
            icon: const Icon(Icons.close_rounded, size: 16),
            onPressed: onRemove,
            tooltip: 'Remove attachment',
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 28, minHeight: 28),
          ),
        ],
      ),
    );
  }
}

class _StatusLine extends StatelessWidget {
  const _StatusLine({required this.upload});

  final PendingAttachmentUpload upload;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    switch (upload.status) {
      case PendingUploadStatus.uploading:
        return ClipRRect(
          borderRadius: BorderRadius.circular(2),
          child: LinearProgressIndicator(
            value: upload.progress,
            minHeight: 3,
            backgroundColor: Theme.of(context).colorScheme.surfaceContainerHighest,
          ),
        );
      case PendingUploadStatus.processing:
        return Text(
          'Processing...',
          style: textTheme.labelSmall?.copyWith(color: Theme.of(context).colorScheme.outline),
        );
      case PendingUploadStatus.error:
        return Text(
          upload.error ?? 'Upload failed',
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: textTheme.labelSmall?.copyWith(color: Theme.of(context).colorScheme.error),
        );
      case PendingUploadStatus.done:
        return Text(
          _formatBytes(upload.attachment?.sizeBytes ?? 0),
          style: textTheme.labelSmall?.copyWith(color: Theme.of(context).colorScheme.outline),
        );
    }
  }
}

bool _looksLikeImagePath(String path) {
  final lower = path.toLowerCase();
  return lower.endsWith('.jpg') ||
      lower.endsWith('.jpeg') ||
      lower.endsWith('.png') ||
      lower.endsWith('.gif') ||
      lower.endsWith('.webp') ||
      lower.endsWith('.heic');
}

String _formatBytes(int bytes) {
  if (bytes < 1024) return '$bytes B';
  if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
  return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
}
