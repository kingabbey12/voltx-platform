import 'package:flutter/material.dart';

import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';
import '../../data/models/ai_models.dart';

/// File and image attachment UI (mock — no actual picker).
class AttachmentPickerUi extends StatelessWidget {
  const AttachmentPickerUi({
    required this.attachments,
    required this.onRemove,
    super.key,
  });

  final List<AiAttachment> attachments;
  final ValueChanged<String> onRemove;

  static Widget addButtons({
    required VoidCallback onAddFile,
    required VoidCallback onAddImage,
  }) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        IconButton(
          icon: const Icon(Icons.attach_file_rounded),
          tooltip: 'Attach file',
          onPressed: onAddFile,
        ),
        IconButton(
          icon: const Icon(Icons.image_outlined),
          tooltip: 'Attach image',
          onPressed: onAddImage,
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.voltxColors;

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.xs),
      child: Wrap(
        spacing: AppSpacing.xs,
        children: [
          for (final attachment in attachments)
            Chip(
              avatar: Icon(
                attachment.type == AiAttachmentType.image
                    ? Icons.image_outlined
                    : Icons.insert_drive_file_outlined,
                size: 16,
              ),
              label: Text('${attachment.name} · ${attachment.sizeLabel}'),
              deleteIcon: const Icon(Icons.close, size: 16),
              onDeleted: () => onRemove(attachment.id),
              backgroundColor: colors.surfaceMuted,
              side: BorderSide(color: colors.borderSubtle),
            ),
        ],
      ),
    );
  }
}
