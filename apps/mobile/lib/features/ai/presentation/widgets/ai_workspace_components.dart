import 'package:flutter/material.dart';

import '../../../../theme/tokens/spacing.dart';
import '../../../dashboard/presentation/widgets/dashboard_v2_tokens.dart';
import '../../data/models/ai_models.dart';

class AiPanel extends StatelessWidget {
  const AiPanel({
    required this.child,
    this.padding,
    this.onTap,
    this.header,
    this.fillChild = false,
    this.highlighted = false,
    super.key,
  });

  final Widget child;
  final Widget? header;
  final bool fillChild;
  final bool highlighted;
  final EdgeInsetsGeometry? padding;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final t = DashboardV2Tokens.of(context);

    final body = Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(t.radiusXl),
        border: Border.all(color: t.border.withValues(alpha: 0.92)),
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [
            t.panel.withValues(alpha: highlighted ? 0.98 : 0.95),
            t.panelStrong.withValues(alpha: highlighted ? 0.95 : 0.9),
          ],
        ),
        boxShadow: [
          ...t.cardShadow,
          BoxShadow(
            color: t.glow.withValues(alpha: highlighted ? 0.24 : 0.14),
            blurRadius: highlighted ? 30 : 20,
            spreadRadius: -12,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      padding: padding ?? const EdgeInsets.all(AppSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (header != null) ...[
            header!,
            const SizedBox(height: AppSpacing.md),
          ],
          if (fillChild) Expanded(child: child) else child,
        ],
      ),
    );

    if (onTap == null) {
      return body;
    }

    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(t.radiusXl),
        onTap: onTap,
        child: body,
      ),
    );
  }
}

class AiSidebar extends StatelessWidget {
  const AiSidebar({
    required this.child,
    required this.width,
    this.title,
    this.trailing,
    super.key,
  });

  final double width;
  final String? title;
  final Widget? trailing;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final t = DashboardV2Tokens.of(context);

    return SizedBox(
      width: width,
      child: Container(
        decoration: BoxDecoration(
          color: t.panel.withValues(alpha: 0.8),
          border: Border(
            right: BorderSide(color: t.border),
          ),
        ),
        padding: const EdgeInsets.all(AppSpacing.sm),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (title != null) ...[
              Row(
                children: [
                  Expanded(
                    child: Text(
                      title!,
                      style: Theme.of(context).textTheme.titleSmall?.copyWith(
                            fontWeight: FontWeight.w700,
                            color: t.textPrimary,
                          ),
                    ),
                  ),
                  ...?(trailing == null ? null : <Widget>[trailing!]),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
            ],
            Expanded(child: child),
          ],
        ),
      ),
    );
  }
}

class AiConversationCard extends StatelessWidget {
  const AiConversationCard({
    required this.conversation,
    required this.selected,
    required this.onTap,
    this.showPin = true,
    super.key,
  });

  final AiConversation conversation;
  final bool selected;
  final bool showPin;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = DashboardV2Tokens.of(context);

    return AiPanel(
      onTap: onTap,
      highlighted: selected,
      padding: const EdgeInsets.all(AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  conversation.title,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: selected ? t.primary : t.textPrimary,
                      ),
                ),
              ),
              if (showPin && conversation.pinned)
                Icon(Icons.push_pin_rounded, size: 14, color: t.warning),
            ],
          ),
          const SizedBox(height: AppSpacing.xxs),
          Text(
            conversation.preview,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: t.textSecondary,
                ),
          ),
          const SizedBox(height: AppSpacing.xxs),
          Text(
            _relativeTime(conversation.updatedAt),
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: t.textTertiary,
                ),
          ),
        ],
      ),
    );
  }

  String _relativeTime(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 60) {
      return '${diff.inMinutes}m ago';
    }
    if (diff.inHours < 24) {
      return '${diff.inHours}h ago';
    }
    return '${diff.inDays}d ago';
  }
}

class AiMessageBubble extends StatelessWidget {
  const AiMessageBubble({
    required this.isUser,
    required this.timestamp,
    required this.child,
    this.actions,
    super.key,
  });

  final bool isUser;
  final DateTime timestamp;
  final Widget child;
  final Widget? actions;

  @override
  Widget build(BuildContext context) {
    final t = DashboardV2Tokens.of(context);

    return Align(
      alignment: isUser ? Alignment.centerRight : Alignment.centerLeft,
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: MediaQuery.sizeOf(context).width * 0.78),
        child: Column(
          crossAxisAlignment: isUser ? CrossAxisAlignment.end : CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(AppSpacing.sm),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(t.radiusLg),
                color: isUser
                    ? t.primary.withValues(alpha: 0.12)
                    : t.panelStrong.withValues(alpha: 0.82),
                border: Border.all(color: t.border),
              ),
              child: child,
            ),
            const SizedBox(height: 2),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  _formatTime(timestamp),
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: t.textTertiary,
                      ),
                ),
                if (actions != null) ...[
                  const SizedBox(width: AppSpacing.xs),
                  actions!,
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  String _formatTime(DateTime time) {
    final hour = time.hour % 12 == 0 ? 12 : time.hour % 12;
    final minute = time.minute.toString().padLeft(2, '0');
    final ampm = time.hour >= 12 ? 'PM' : 'AM';
    return '$hour:$minute $ampm';
  }
}

class AiComposer extends StatelessWidget {
  const AiComposer({
    required this.textField,
    required this.leading,
    required this.trailing,
    this.attachments,
    this.header,
    super.key,
  });

  final Widget textField;
  final Widget leading;
  final Widget trailing;
  final Widget? attachments;
  final Widget? header;

  @override
  Widget build(BuildContext context) {
    final t = DashboardV2Tokens.of(context);

    return Container(
      margin: const EdgeInsets.fromLTRB(AppSpacing.md, AppSpacing.xs, AppSpacing.md, AppSpacing.md),
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(t.radiusXl),
        border: Border.all(color: t.border),
        color: t.panel.withValues(alpha: 0.96),
        boxShadow: t.cardShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (header != null) ...[
            header!,
            const SizedBox(height: AppSpacing.xs),
          ],
          if (attachments != null) ...[
            attachments!,
            const SizedBox(height: AppSpacing.xs),
          ],
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              leading,
              const SizedBox(width: AppSpacing.xs),
              Expanded(child: textField),
              const SizedBox(width: AppSpacing.xs),
              trailing,
            ],
          ),
        ],
      ),
    );
  }
}

class AiAgentCard extends StatelessWidget {
  const AiAgentCard({
    required this.agent,
    required this.selected,
    required this.onTap,
    required this.status,
    required this.secondaryLabel,
    required this.toolCount,
    required this.recentActivity,
    this.onRun,
    super.key,
  });

  final AiAgent agent;
  final bool selected;
  final VoidCallback onTap;
  final String status;

  /// A short secondary stat chip — memory freshness on the chat panel's
  /// agent cards, run success rate on the agent list screen. Always a real,
  /// backend-derived value; never fabricated.
  final String secondaryLabel;
  final int toolCount;
  final String recentActivity;
  final VoidCallback? onRun;

  @override
  Widget build(BuildContext context) {
    final t = DashboardV2Tokens.of(context);

    return AiPanel(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 16,
                backgroundColor: t.primary.withValues(alpha: 0.12),
                child: Icon(Icons.smart_toy_rounded, color: t.primary, size: 18),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  agent.name,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: selected ? t.primary : t.textPrimary,
                      ),
                ),
              ),
              AiSuggestionChip(label: status, icon: Icons.circle, color: _statusColor(t)),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            agent.description,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: t.textSecondary,
                ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.xs,
            runSpacing: AppSpacing.xs,
            children: [
              AiSuggestionChip(label: secondaryLabel, icon: Icons.insights_rounded),
              AiSuggestionChip(label: '$toolCount tools', icon: Icons.handyman_rounded),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            recentActivity,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(color: t.textTertiary),
          ),
          if (onRun != null) ...[
            const SizedBox(height: AppSpacing.sm),
            FilledButton.tonalIcon(
              onPressed: onRun,
              icon: const Icon(Icons.play_arrow_rounded),
              label: const Text('Run agent'),
            ),
          ],
        ],
      ),
    );
  }

  Color _statusColor(DashboardV2Tokens t) {
    final upper = status.toUpperCase();
    if (upper.contains('SELECTED') || upper.contains('ACTIVE')) {
      return t.success;
    }
    if (upper.contains('IDLE') || upper.contains('DISABLED')) {
      return t.warning;
    }
    return t.primary;
  }
}

class AiKnowledgeCard extends StatelessWidget {
  const AiKnowledgeCard({
    required this.title,
    required this.description,
    required this.documents,
    required this.category,
    required this.lastSynced,
    required this.selected,
    required this.onTap,
    super.key,
  });

  final String title;
  final String description;
  final int documents;
  final String category;
  final String lastSynced;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = DashboardV2Tokens.of(context);

    return AiPanel(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(Icons.library_books_outlined, color: selected ? t.primary : t.textSecondary),
              const SizedBox(width: AppSpacing.xs),
              Expanded(
                child: Text(
                  title,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: selected ? t.primary : t.textPrimary,
                      ),
                ),
              ),
              AiSuggestionChip(label: category, icon: Icons.category_outlined),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            description,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(color: t.textSecondary),
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              Text(
                '$documents docs',
                style: Theme.of(context).textTheme.labelMedium?.copyWith(color: t.textSecondary),
              ),
              const Spacer(),
              Text(
                'Synced $lastSynced',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(color: t.textTertiary),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class AiToolExecutionCard extends StatelessWidget {
  const AiToolExecutionCard({required this.execution, super.key});

  final AiToolExecution execution;

  @override
  Widget build(BuildContext context) {
    final t = DashboardV2Tokens.of(context);

    final (icon, color) = switch (execution.status) {
      AiToolStatus.running => (Icons.sync_rounded, t.primary),
      AiToolStatus.completed => (Icons.check_circle_outline_rounded, t.success),
      AiToolStatus.failed => (Icons.error_outline_rounded, t.error),
    };

    return AiPanel(
      padding: const EdgeInsets.all(AppSpacing.sm),
      child: Row(
        children: [
          execution.status == AiToolStatus.running
              ? SizedBox(
                  width: 16,
                  height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2, color: color),
                )
              : Icon(icon, size: 18, color: color),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  execution.toolName,
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: t.textPrimary,
                      ),
                ),
                Text(
                  execution.output,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(color: t.textSecondary),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class AiMemoryCard extends StatelessWidget {
  const AiMemoryCard({
    required this.title,
    required this.summary,
    required this.items,
    super.key,
  });

  final String title;
  final String summary;
  final List<String> items;

  @override
  Widget build(BuildContext context) {
    final t = DashboardV2Tokens.of(context);

    return AiPanel(
      header: Text(
        title,
        style: Theme.of(context).textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w700,
              color: t.textPrimary,
            ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            summary,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(color: t.textSecondary),
          ),
          const SizedBox(height: AppSpacing.sm),
          for (final item in items)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.xxs),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.circle, size: 8, color: t.primary),
                  const SizedBox(width: AppSpacing.xs),
                  Expanded(
                    child: Text(
                      item,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(color: t.textSecondary),
                    ),
                  ),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class AiContextCard extends StatelessWidget {
  const AiContextCard({
    required this.label,
    required this.value,
    this.trailing,
    super.key,
  });

  final String label;
  final String value;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final t = DashboardV2Tokens.of(context);

    return Container(
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: t.panelStrong.withValues(alpha: 0.7),
        borderRadius: BorderRadius.circular(t.radiusLg),
        border: Border.all(color: t.border),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(color: t.textTertiary),
                ),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: t.textPrimary,
                        fontWeight: FontWeight.w600,
                      ),
                ),
              ],
            ),
          ),
          ...?(trailing == null ? null : <Widget>[trailing!]),
        ],
      ),
    );
  }
}

class AiTimeline extends StatelessWidget {
  const AiTimeline({required this.items, super.key});

  final List<AiTimelineItem> items;

  @override
  Widget build(BuildContext context) {
    final t = DashboardV2Tokens.of(context);

    if (items.isEmpty) {
      return const AiEmptyState(
        title: 'No timeline events',
        subtitle: 'Conversation activity will appear here.',
        icon: Icons.timeline_rounded,
      );
    }

    return Column(
      children: [
        for (var i = 0; i < items.length; i++)
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Column(
                children: [
                  Container(
                    width: 10,
                    height: 10,
                    decoration: BoxDecoration(color: items[i].color ?? t.primary, shape: BoxShape.circle),
                  ),
                  if (i < items.length - 1)
                    Container(
                      width: 2,
                      height: 42,
                      color: t.border,
                    ),
                ],
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                  child: AiPanel(
                    padding: const EdgeInsets.all(AppSpacing.sm),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          items[i].title,
                          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                                fontWeight: FontWeight.w700,
                                color: t.textPrimary,
                              ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          items[i].subtitle,
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(color: t.textSecondary),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          items[i].time,
                          style: Theme.of(context).textTheme.labelSmall?.copyWith(color: t.textTertiary),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
      ],
    );
  }
}

class AiTimelineItem {
  const AiTimelineItem({
    required this.title,
    required this.subtitle,
    required this.time,
    this.color,
  });

  final String title;
  final String subtitle;
  final String time;
  final Color? color;
}

class AiSuggestionChip extends StatelessWidget {
  const AiSuggestionChip({
    required this.label,
    this.icon,
    this.onTap,
    this.color,
    super.key,
  });

  final String label;
  final IconData? icon;
  final VoidCallback? onTap;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final t = DashboardV2Tokens.of(context);
    final accent = color ?? t.primary;

    return InkWell(
      borderRadius: BorderRadius.circular(t.radiusPill),
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: AppSpacing.xxs),
        decoration: BoxDecoration(
          color: accent.withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(t.radiusPill),
          border: Border.all(color: accent.withValues(alpha: 0.28)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(icon, size: 12, color: accent),
              const SizedBox(width: 4),
            ],
            Text(
              label,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: accent,
                    fontWeight: FontWeight.w700,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

class AiPromptCard extends StatelessWidget {
  const AiPromptCard({
    required this.title,
    required this.prompt,
    required this.icon,
    required this.onTap,
    super.key,
  });

  final String title;
  final String prompt;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final t = DashboardV2Tokens.of(context);

    return AiPanel(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, size: 18, color: t.primary),
              const SizedBox(width: AppSpacing.xs),
              Expanded(
                child: Text(
                  title,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: t.textPrimary,
                      ),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            prompt,
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(color: t.textSecondary),
          ),
        ],
      ),
    );
  }
}

class AiArtifactCard extends StatelessWidget {
  const AiArtifactCard({
    required this.title,
    required this.type,
    required this.summary,
    this.onOpen,
    super.key,
  });

  final String title;
  final String type;
  final String summary;
  final VoidCallback? onOpen;

  @override
  Widget build(BuildContext context) {
    return AiPanel(
      onTap: onOpen,
      padding: const EdgeInsets.all(AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AiSuggestionChip(label: type, icon: Icons.inventory_2_outlined),
          const SizedBox(height: AppSpacing.xs),
          Text(
            title,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 2),
          Text(
            summary,
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}

class AiLoadingState extends StatelessWidget {
  const AiLoadingState({
    this.lines = 3,
    super.key,
  });

  final int lines;

  @override
  Widget build(BuildContext context) {
    final t = DashboardV2Tokens.of(context);

    return Column(
      children: [
        for (var i = 0; i < lines; i++) ...[
          AiPanel(
            padding: const EdgeInsets.all(AppSpacing.sm),
            child: Column(
              children: [
                Container(
                  height: 12,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        t.panelStrong.withValues(alpha: 0.45),
                        t.panelStrong.withValues(alpha: 0.22),
                      ],
                    ),
                    borderRadius: const BorderRadius.all(Radius.circular(999)),
                  ),
                ),
                const SizedBox(height: AppSpacing.xs),
                Container(
                  height: 10,
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: t.panelStrong.withValues(alpha: 0.24),
                    borderRadius: const BorderRadius.all(Radius.circular(999)),
                  ),
                ),
              ],
            ),
          ),
          if (i < lines - 1) const SizedBox(height: AppSpacing.sm),
        ],
      ],
    );
  }
}

class AiEmptyState extends StatelessWidget {
  const AiEmptyState({
    required this.title,
    required this.subtitle,
    required this.icon,
    super.key,
  });

  final String title;
  final String subtitle;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    final t = DashboardV2Tokens.of(context);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md, vertical: AppSpacing.lg),
      decoration: BoxDecoration(
        color: t.panelStrong.withValues(alpha: 0.45),
        borderRadius: BorderRadius.circular(t.radiusLg),
        border: Border.all(color: t.border.withValues(alpha: 0.85)),
      ),
      child: Center(
        child: Column(
          children: [
            Container(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                color: t.primary.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, size: 22, color: t.primary),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              title,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: t.textPrimary,
                    fontWeight: FontWeight.w700,
                  ),
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              subtitle,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: t.textSecondary),
            ),
          ],
        ),
      ),
    );
  }
}

class AiStreamingIndicator extends StatelessWidget {
  const AiStreamingIndicator({super.key});

  @override
  Widget build(BuildContext context) {
    final t = DashboardV2Tokens.of(context);

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        const _PulseDot(delayMs: 0),
        const SizedBox(width: 4),
        const _PulseDot(delayMs: 180),
        const SizedBox(width: 4),
        const _PulseDot(delayMs: 360),
        const SizedBox(width: AppSpacing.xs),
        Text(
          'Streaming',
          style: Theme.of(context).textTheme.labelSmall?.copyWith(
                color: t.textTertiary,
              ),
        ),
      ],
    );
  }
}

class _PulseDot extends StatefulWidget {
  const _PulseDot({required this.delayMs});

  final int delayMs;

  @override
  State<_PulseDot> createState() => _PulseDotState();
}

class _PulseDotState extends State<_PulseDot> with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );

    Future<void>.delayed(Duration(milliseconds: widget.delayMs), () {
      if (mounted) {
        _controller.repeat(reverse: true);
      }
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final t = DashboardV2Tokens.of(context);

    return FadeTransition(
      opacity: Tween<double>(begin: 0.3, end: 1).animate(
        CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
      ),
      child: Container(
        width: 7,
        height: 7,
        decoration: BoxDecoration(
          color: t.primary,
          shape: BoxShape.circle,
        ),
      ),
    );
  }
}
