import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../theme/voltx_theme.dart';
import '../../data/models/attachment_models.dart';
import '../providers/attachment_upload_providers.dart';

/// A tappable attachment chip. Tapping an image opens a full-screen
/// preview; tapping a document shows its details (name/size/type) — this
/// app has no document viewer or save-to-device flow yet, so "preview"
/// for non-image files means showing what it is, not rendering its
/// content.
class AttachmentDownloadTile extends ConsumerWidget {
  const AttachmentDownloadTile({required this.attachment, super.key});

  final RemoteAttachment attachment;

  String _formatBytes(int bytes) {
    if (bytes < 1024) return '$bytes B';
    if (bytes < 1024 * 1024) return '${(bytes / 1024).toStringAsFixed(1)} KB';
    return '${(bytes / (1024 * 1024)).toStringAsFixed(1)} MB';
  }

  void _openPreview(BuildContext context, WidgetRef ref) {
    if (attachment.isImage) {
      Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => _ImagePreviewScreen(attachment: attachment),
        ),
      );
      return;
    }

    showModalBottomSheet<void>(
      context: context,
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(attachment.fileName, style: Theme.of(sheetContext).textTheme.titleMedium),
              const SizedBox(height: 8),
              Text('${attachment.mimeType} · ${_formatBytes(attachment.sizeBytes)}'),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.voltxColors;

    return InkWell(
      borderRadius: BorderRadius.circular(10),
      onTap: () => _openPreview(context, ref),
      child: Container(
        width: 180,
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(10),
          color: colors.surfaceMuted,
          border: Border.all(color: colors.borderSubtle),
        ),
        child: Row(
          children: [
            SizedBox(
              width: 36,
              height: 36,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(8),
                child: attachment.hasThumbnail
                    ? _ThumbnailImage(attachmentId: attachment.id)
                    : Container(
                        color: colors.surfaceMuted,
                        child: Icon(
                          attachment.isImage
                              ? Icons.image_outlined
                              : Icons.insert_drive_file_outlined,
                          size: 16,
                          color: colors.borderSubtle,
                        ),
                      ),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                attachment.fileName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.labelSmall,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ThumbnailImage extends ConsumerWidget {
  const _ThumbnailImage({required this.attachmentId});

  final String attachmentId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final repository = ref.watch(attachmentRepositoryProvider);
    return FutureBuilder<List<int>>(
      future: repository.downloadThumbnail(attachmentId),
      builder: (context, snapshot) {
        if (!snapshot.hasData) return const SizedBox.shrink();
        return Image.memory(Uint8List.fromList(snapshot.data!), fit: BoxFit.cover);
      },
    );
  }
}

class _ImagePreviewScreen extends ConsumerWidget {
  const _ImagePreviewScreen({required this.attachment});

  final RemoteAttachment attachment;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final repository = ref.watch(attachmentRepositoryProvider);

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        foregroundColor: Colors.white,
        title: Text(attachment.fileName, overflow: TextOverflow.ellipsis),
      ),
      body: FutureBuilder<List<int>>(
        future: repository.downloadFile(attachment.id),
        builder: (context, snapshot) {
          if (!snapshot.hasData) {
            return const Center(child: CircularProgressIndicator());
          }
          return Center(
            child: InteractiveViewer(
              child: Image.memory(Uint8List.fromList(snapshot.data!)),
            ),
          );
        },
      ),
    );
  }
}
