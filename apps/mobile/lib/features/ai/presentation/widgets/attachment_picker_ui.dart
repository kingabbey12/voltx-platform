import 'package:flutter/material.dart';

import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';
import '../../data/models/ai_models.dart';

/// File and image attachment UI. Chip rendering below is real (works with
/// genuine attachments once they exist); the add buttons are disabled since
/// there is no attachment upload endpoint or AI ingestion pipeline on the
/// backend yet — see AiAttachment's doc comment. Previously these buttons
/// silently inserted hardcoded fake files regardless of what was tapped,
/// which is worse than being disabled.
class AttachmentPickerUi extends StatelessWidget {
  const AttachmentPickerUi({
    required this.attachments,
    required this.onRemove,
    super.key,
  });

  final List<AiAttachment> attachments;
  final ValueChanged<String> onRemove;

  static Widget addButtons() {
    return const Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        IconButton(
          icon: Icon(Icons.attach_file_rounded),
          tooltip: 'Attachments coming soon',
          onPressed: null,
        ),
        IconButton(
          icon: Icon(Icons.image_outlined),
          tooltip: 'Attachments coming soon',
          onPressed: null,
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
