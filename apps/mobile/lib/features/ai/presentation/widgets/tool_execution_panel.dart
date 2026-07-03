import 'package:flutter/material.dart';

import '../../../../theme/tokens/motion_tokens.dart';
import '../../../../theme/tokens/spacing.dart';
import '../../../../theme/voltx_theme.dart';
import '../../data/models/ai_models.dart';

/// Tool execution status panel.
class ToolExecutionPanel extends StatelessWidget {
  const ToolExecutionPanel({required this.execution, super.key});

  final AiToolExecution execution;

  @override
  Widget build(BuildContext context) {
    final colors = context.voltxColors;
    final scheme = Theme.of(context).colorScheme;

    final statusColor = switch (execution.status) {
      AiToolStatus.running => scheme.primary,
      AiToolStatus.completed => colors.success,
      AiToolStatus.failed => colors.error,
    };

    final statusIcon = switch (execution.status) {
      AiToolStatus.running => Icons.sync_rounded,
      AiToolStatus.completed => Icons.check_circle_outline_rounded,
      AiToolStatus.failed => Icons.error_outline_rounded,
    };

    return AnimatedContainer(
      duration: MotionTokens.fast,
      margin: const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: statusColor.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: statusColor.withValues(alpha: 0.2)),
      ),
      child: Row(
        children: [
          if (execution.status == AiToolStatus.running)
            SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(strokeWidth: 2, color: statusColor),
            )
          else
            Icon(statusIcon, size: 18, color: statusColor),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  execution.toolName,
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        fontWeight: FontWeight.w600,
                      ),
                ),
                Text(
                  execution.output,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: colors.textSecondary,
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
