import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../theme/components/voltx_button.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';
import '../../data/models/ai_models.dart';
import '../providers/ai_providers.dart';
import 'attachment_picker_ui.dart';

/// Prompt input editor with attachments and send/stop controls.
class PromptEditor extends HookConsumerWidget {
  const PromptEditor({
    required this.onSend,
    required this.onStop,
    required this.isStreaming,
    super.key,
  });

  final ValueChanged<String> onSend;
  final VoidCallback onStop;
  final bool isStreaming;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final controller = useTextEditingController();
    final conversationId = ref.watch(activeConversationIdProvider);
    final chatState = ref.watch(aiChatProvider(conversationId));
    final colors = context.voltxColors;

    return Container(
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: colors.surfaceElevated,
        border: Border(top: BorderSide(color: colors.borderSubtle)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (chatState.pendingAttachments.isNotEmpty)
            AttachmentPickerUi(
              attachments: chatState.pendingAttachments,
              onRemove: (id) => ref
                  .read(aiChatProvider(conversationId).notifier)
                  .removePendingAttachment(id),
            ),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              AttachmentPickerUi.addButtons(
                onAddFile: () => ref
                    .read(aiChatProvider(conversationId).notifier)
                    .addPendingAttachment(
                      AiAttachment(
                        id: 'file-${DateTime.now().millisecondsSinceEpoch}',
                        name: 'grid_report_q3.pdf',
                        type: AiAttachmentType.file,
                        sizeLabel: '2.4 MB',
                      ),
                    ),
                onAddImage: () => ref
                    .read(aiChatProvider(conversationId).notifier)
                    .addPendingAttachment(
                      AiAttachment(
                        id: 'img-${DateTime.now().millisecondsSinceEpoch}',
                        name: 'substation_photo.jpg',
                        type: AiAttachmentType.image,
                        sizeLabel: '840 KB',
                      ),
                    ),
              ),
              const SizedBox(width: AppSpacing.xs),
              Expanded(
                child: TextField(
                  controller: controller,
                  maxLines: 4,
                  minLines: 1,
                  decoration: InputDecoration(
                    hintText: 'Message Voltx AI…',
                    filled: true,
                    fillColor: colors.surfaceMuted,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: colors.borderSubtle),
                    ),
                  ),
                  onSubmitted: isStreaming ? null : onSend,
                ),
              ),
              const SizedBox(width: AppSpacing.xs),
              if (isStreaming)
                VoltxButton(
                  label: 'Stop',
                  variant: VoltxButtonVariant.destructive,
                  icon: Icons.stop_rounded,
                  onPressed: onStop,
                )
              else
                VoltxButton(
                  label: 'Send',
                  icon: Icons.arrow_upward_rounded,
                  onPressed: () {
                    onSend(controller.text);
                    controller.clear();
                  },
                ),
            ],
          ),
        ],
      ),
    );
  }
}
