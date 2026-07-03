import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';
import '../../data/models/ai_models.dart';
import 'markdown_message.dart';
import 'typing_indicator.dart';

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
    final colors = context.voltxColors;
    final scheme = Theme.of(context).colorScheme;
    final isUser = message.isUser;
    final content = message.displayContent;

    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.82),
        child: Column(
          crossAxisAlignment:
              isUser ? CrossAxisAlignment.end : CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(AppSpacing.sm),
              decoration: BoxDecoration(
                color: isUser
                    ? scheme.primary.withValues(alpha: 0.12)
                    : colors.surfaceMuted,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: colors.borderSubtle),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (message.attachments.isNotEmpty) ...[
                    Wrap(
                      spacing: AppSpacing.xs,
                      children: [
                        for (final a in message.attachments)
                          Chip(
                            avatar: Icon(
                              a.type == AiAttachmentType.image
                                  ? Icons.image_outlined
                                  : Icons.insert_drive_file_outlined,
                              size: 16,
                            ),
                            label: Text(a.name),
                          ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.xs),
                  ],
                  if (isUser)
                    Text(content, style: Theme.of(context).textTheme.bodyMedium)
                  else if (content.isEmpty && message.isStreaming)
                    const TypingIndicator()
                  else if (content.isNotEmpty)
                    MarkdownMessage(content: content)
                  else
                    const TypingIndicator(),
                ],
              ),
            ),
            if (!isUser && content.isNotEmpty && !message.isStreaming) ...[
              const SizedBox(height: AppSpacing.xxs),
              Row(
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
              ),
            ],
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
    final colors = context.voltxColors;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: colors.textTertiary),
            const SizedBox(width: 4),
            Text(
              label,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: colors.textTertiary,
                  ),
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
