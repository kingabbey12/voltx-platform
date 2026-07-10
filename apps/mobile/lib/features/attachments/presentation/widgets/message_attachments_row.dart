import 'package:flutter/material.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../data/models/attachment_models.dart';
import '../providers/attachment_upload_providers.dart';
import 'attachment_download_tile.dart';

/// Renders a message's attachments. For a just-sent message, [knownIds]
/// (already in memory client-side) is used directly — no network round
/// trip needed. For historical messages (knownIds empty), attachments are
/// looked up by AI_MESSAGE reference using [messageId], since the backend
/// doesn't embed them in the message payload itself.
class MessageAttachmentsRow extends ConsumerWidget {
  const MessageAttachmentsRow({
    required this.messageId,
    required this.knownAttachments,
    super.key,
  });

  final String messageId;
  final List<RemoteAttachment> knownAttachments;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (knownAttachments.isNotEmpty) {
      return _AttachmentsWrap(attachments: knownAttachments);
    }

    final asyncAttachments = ref.watch(messageAttachmentsProvider(messageId));
    return asyncAttachments.when(
      data: (attachments) =>
          attachments.isEmpty ? const SizedBox.shrink() : _AttachmentsWrap(attachments: attachments),
      loading: () => const SizedBox.shrink(),
      error: (_, _) => const SizedBox.shrink(),
    );
  }
}

class _AttachmentsWrap extends StatelessWidget {
  const _AttachmentsWrap({required this.attachments});

  final List<RemoteAttachment> attachments;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        children: [
          for (final attachment in attachments) AttachmentDownloadTile(attachment: attachment),
        ],
      ),
    );
  }
}
