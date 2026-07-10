import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../theme/components/voltx_button.dart';
import '../../../../theme/tokens/spacing.dart';
import '../providers/ai_providers.dart';
import 'attachment_picker_ui.dart';
import 'ai_workspace_components.dart';

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

    void sendCurrent() {
      final text = controller.text.trim();
      if (text.isEmpty) {
        return;
      }

      onSend(text);
      controller.clear();
    }

    return AiComposer(
      header: Row(
        children: [
          Text(
            'Prompt Composer',
            style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(width: AppSpacing.xs),
          AiSuggestionChip(
            label: isStreaming ? 'Streaming' : 'Ready',
            icon: isStreaming ? Icons.stream_rounded : Icons.check_circle_outline_rounded,
          ),
          const Spacer(),
          const AiSuggestionChip(label: 'Attachments', icon: Icons.attach_file_rounded),
        ],
      ),
      attachments: chatState.pendingAttachments.isNotEmpty
          ? AttachmentPickerUi(
              attachments: chatState.pendingAttachments,
              onRemove: (id) => ref
                  .read(aiChatProvider(conversationId).notifier)
                  .removePendingAttachment(id),
            )
          : null,
      leading: AttachmentPickerUi.addButtons(),
      textField: TextField(
        controller: controller,
        maxLines: 4,
        minLines: 1,
        decoration: const InputDecoration(
          hintText: 'Ask AI to reason with tools, memory, and knowledge context...',
        ),
        onSubmitted: isStreaming ? null : (_) => sendCurrent(),
      ),
      trailing: isStreaming
          ? VoltxButton(
              label: 'Stop',
              variant: VoltxButtonVariant.destructive,
              icon: Icons.stop_rounded,
              onPressed: onStop,
            )
          : VoltxButton(
              label: 'Send',
              icon: Icons.arrow_upward_rounded,
              onPressed: sendCurrent,
            ),
    );
  }
}
