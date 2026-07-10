import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../providers/attachment_upload_providers.dart';

/// Fetches and renders an attachment's thumbnail bytes through the
/// authenticated Dio client — the backend's thumbnail endpoint requires a
/// bearer token, so this can't be a plain `Image.network`.
class AttachmentThumbnail extends ConsumerWidget {
  const AttachmentThumbnail({required this.attachmentId, super.key});

  final String attachmentId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final repository = ref.watch(attachmentRepositoryProvider);

    return FutureBuilder<List<int>>(
      future: repository.downloadThumbnail(attachmentId),
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done || !snapshot.hasData) {
          return const ColoredBox(color: Color(0x11000000));
        }
        return Image.memory(
          Uint8List.fromList(snapshot.data!),
          fit: BoxFit.cover,
          errorBuilder: (_, _, _) => const ColoredBox(color: Color(0x11000000)),
        );
      },
    );
  }
}
