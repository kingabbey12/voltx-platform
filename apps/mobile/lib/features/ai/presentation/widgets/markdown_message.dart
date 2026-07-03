import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';

import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';

/// Renders assistant messages with markdown and code blocks.
class MarkdownMessage extends StatelessWidget {
  const MarkdownMessage({required this.content, super.key});

  final String content;

  @override
  Widget build(BuildContext context) {
    final colors = context.voltxColors;
    final scheme = Theme.of(context).colorScheme;

    return MarkdownBody(
      data: content,
      selectable: true,
      styleSheet: MarkdownStyleSheet(
        p: Theme.of(context).textTheme.bodyMedium,
        h2: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700),
        h3: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600),
        listBullet: Theme.of(context).textTheme.bodyMedium,
        code: TextStyle(
          fontFamily: 'monospace',
          fontSize: 13,
          color: scheme.primary,
          backgroundColor: colors.surfaceMuted,
        ),
        codeblockDecoration: BoxDecoration(
          color: colors.surfaceMuted,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: colors.borderSubtle),
        ),
        codeblockPadding: const EdgeInsets.all(AppSpacing.sm),
        blockquoteDecoration: BoxDecoration(
          border: Border(left: BorderSide(color: scheme.primary, width: 3)),
        ),
        blockquotePadding: const EdgeInsets.only(left: AppSpacing.sm),
      ),
    );
  }
}
