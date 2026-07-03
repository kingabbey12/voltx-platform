import 'package:flutter/material.dart';
import 'package:flutter_hooks/flutter_hooks.dart';
import 'package:hooks_riverpod/hooks_riverpod.dart';

import '../../../../theme/components/voltx_button.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';
import '../providers/dashboard_providers.dart';

/// Full AI workspace chat screen.
class AiWorkspaceScreen extends HookConsumerWidget {
  const AiWorkspaceScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final controller = useTextEditingController();
    final messages = ref.watch(aiChatMessagesProvider);
    final scheme = Theme.of(context).colorScheme;

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Row(
            children: [
              Icon(Icons.auto_awesome_rounded, color: scheme.primary),
              const SizedBox(width: AppSpacing.xs),
              Text('AI Workspace', style: Theme.of(context).textTheme.headlineSmall),
            ],
          ),
        ),
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
            itemCount: messages.length,
            itemBuilder: (context, index) {
              final message = messages[index];
              return _ChatBubble(
                content: message.content,
                isUser: message.isUser,
              );
            },
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: controller,
                  decoration: InputDecoration(
                    hintText: 'Ask Voltx AI anything…',
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  onSubmitted: (value) {
                    ref.read(aiChatMessagesProvider.notifier).sendMessage(value);
                    controller.clear();
                  },
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              VoltxButton(
                label: 'Send',
                icon: Icons.send_rounded,
                onPressed: () {
                  ref.read(aiChatMessagesProvider.notifier).sendMessage(controller.text);
                  controller.clear();
                },
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ChatBubble extends StatelessWidget {
  const _ChatBubble({required this.content, required this.isUser});

  final String content;
  final bool isUser;

  @override
  Widget build(BuildContext context) {
    final colors = context.voltxColors;
    final scheme = Theme.of(context).colorScheme;

    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.only(bottom: AppSpacing.sm),
        padding: const EdgeInsets.all(AppSpacing.sm),
        constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.75),
        decoration: BoxDecoration(
          color: isUser
              ? scheme.primary.withValues(alpha: 0.12)
              : colors.surfaceMuted,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: colors.borderSubtle),
        ),
        child: Text(content, style: Theme.of(context).textTheme.bodyMedium),
      ),
    );
  }
}
