import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../theme/tokens/spacing.dart';
import '../../../attachments/presentation/widgets/message_attachments_row.dart';
import '../../data/models/ai_models.dart';
import 'ai_workspace_components.dart';
import 'markdown_message.dart';

/// Individual chat message bubble with actions.
class ChatMessageBubble extends ConsumerWidget {
  const ChatMessageBubble({
    required this.message,
    required this.onCopy,
    required this.onRegenerate,
    this.showRegenerate = false,
    super.key,
  });

  final AiMessage message;
  final VoidCallback onCopy;
  final VoidCallback onRegenerate;
  final bool showRegenerate;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isUser = message.isUser;
    final content = message.displayContent;

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: AiMessageBubble(
        isUser: isUser,
        timestamp: message.timestamp,
        actions: !isUser && content.isNotEmpty && !message.isStreaming
            ? Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  _ActionButton(
                    icon: Icons.copy_rounded,
                    label: 'Copy',
                    onTap: onCopy,
                  ),
                  if (showRegenerate) ...[
                    const SizedBox(width: AppSpacing.xs),
                    _ActionButton(
                      icon: Icons.refresh_rounded,
                      label: 'Regenerate',
                      onTap: onRegenerate,
                    ),
                  ],
                ],
              )
            : null,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            MessageAttachmentsRow(
              messageId: message.id,
              knownAttachments: message.knownAttachments,
            ),
            if (isUser)
              Text(content, style: Theme.of(context).textTheme.bodyMedium)
            else if (content.isEmpty && message.isStreaming)
              const AiStreamingIndicator()
            else if (content.isNotEmpty)
              MarkdownMessage(content: content)
            else
              const AiStreamingIndicator(),
          ],
        ),
      ),
    );
  }
}

class _ActionButton extends StatelessWidget {
  const _ActionButton({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  final IconData icon;
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14),
            const SizedBox(width: 4),
            Text(
              label,
              style: Theme.of(context).textTheme.labelSmall,
            ),
          ],
        ),
      ),
    );
  }
}

void copyMessageToClipboard(AiMessage message) {
  Clipboard.setData(ClipboardData(text: message.displayContent));
}
